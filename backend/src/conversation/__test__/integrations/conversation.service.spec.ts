import { Test, TestingModule } from '@nestjs/testing'
import { ok, err, Result } from 'neverthrow'

import {
  ConversationService,
  InboundWhatsAppMessage,
} from '../../core/service/conversation.service'
import {
  AgentOutcome,
  ConversationAgentService,
} from '../../core/service/conversation-agent.service'
import { ConversationStateRepository } from '../../persist/conversation-state.repository'
import { ReservationAPI } from '@/reservation/external-api'
import { StayRepository } from '@/reservation/persist'
import { ConfigService } from '@/common/config/service/config.service'
import {
  CONVERSATION_LOCK,
  CONVERSATION_NOTIFIER,
  ConversationLock,
  ConversationNotifier,
  ConversationState,
  LockFailureReason,
} from '../../core/contract'

import {
  DEFAULT_PHONE,
  DEFAULT_STAY_ID,
  DEFAULT_WHATSAPP_TO,
  makeState,
  makeInboundMessage,
} from '../fixture/agent'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function flushMicrotasks(): Promise<void> {
  return new Promise(r => setImmediate(r))
}

function makeFakeStateRepo() {
  const states = new Map<string, ConversationState>()
  const processed = new Set<string>()
  const key = (phone: string, stayId: string) => `${stayId}:${phone}`

  return {
    find:          jest.fn(async (phone: string, stayId: string) => states.get(key(phone, stayId)) ?? null),
    save:          jest.fn(async (s: ConversationState) => { states.set(key(s.phone, s.stayId), s) }),
    isProcessed:   jest.fn(async (id: string) => processed.has(id)),
    markProcessed: jest.fn(async (id: string) => { processed.add(id) }),
    delete:        jest.fn(async (phone: string, stayId: string) => { states.delete(key(phone, stayId)) }),
  } as unknown as jest.Mocked<ConversationStateRepository>
}

// First caller gets the handle immediately; subsequent callers queue and are
// resolved in FIFO order as each holder releases.
function makeSerializedLock() {
  let locked = false
  const queue: Array<() => void> = []
  const acquire = jest.fn(async () => {
    if (!locked) {
      locked = true
      return {
        release: jest.fn(async () => {
          locked = false
          const next = queue.shift()
          if (next) next()
        }),
      }
    }
    return new Promise<any>(resolve => {
      queue.push(() => {
        locked = true
        resolve({
          release: jest.fn(async () => {
            locked = false
            const next = queue.shift()
            if (next) next()
          }),
        })
      })
    })
  })
  return { acquire } as unknown as jest.Mocked<ConversationLock>
}

interface Harness {
  service:        ConversationService
  stateRepo:      jest.Mocked<ConversationStateRepository>
  agent:          jest.Mocked<ConversationAgentService>
  reservationAPI: jest.Mocked<ReservationAPI>
  stayRepo:       jest.Mocked<StayRepository>
  notifier:       jest.Mocked<ConversationNotifier>
  lock:           jest.Mocked<ConversationLock>
}

async function bootstrap(overrides: Partial<Harness> = {}): Promise<Harness> {
  const stateRepo = overrides.stateRepo ?? makeFakeStateRepo()

  const agent = (overrides.agent ?? {
    initialState: jest.fn((phone: string, stayId: string) =>
      makeState({ phone, stayId }),
    ),
    process:      jest.fn(),
  }) as unknown as jest.Mocked<ConversationAgentService>

  const reservationAPI = (overrides.reservationAPI ?? {
    generate:                     jest.fn(),
    findWhatsAppNumber:           jest.fn(),
    findBotStaffId:               jest.fn().mockResolvedValue('bot-staff-1'),
    findStayIdByWhatsAppNumber:   jest.fn().mockResolvedValue(DEFAULT_STAY_ID),
  }) as unknown as jest.Mocked<ReservationAPI>

  const stayRepo = (overrides.stayRepo ?? {
    findOneById: jest.fn().mockResolvedValue({ name: 'Hotel Teste' } as any),
  }) as unknown as jest.Mocked<StayRepository>

  const notifier = (overrides.notifier ?? {
    reply: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<ConversationNotifier>

  const lock = overrides.lock ?? makeSerializedLock()

  const config = { get: jest.fn().mockReturnValue('https://booking.example.com') }

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ConversationService,
      { provide: ConversationStateRepository,      useValue: stateRepo },
      { provide: ConversationAgentService,         useValue: agent },
      { provide: ReservationAPI,                   useValue: reservationAPI },
      { provide: StayRepository,                   useValue: stayRepo },
      { provide: ConfigService,                    useValue: config },
      { provide: CONVERSATION_NOTIFIER,            useValue: notifier },
      { provide: CONVERSATION_LOCK,                useValue: lock },
    ],
  }).compile()

  const service = module.get<ConversationService>(ConversationService)
  return { service, stateRepo, agent, reservationAPI, stayRepo, notifier, lock }
}

const REPLY_OUTCOME = (overrides: Partial<ConversationState> = {}): AgentOutcome => ({
  kind:      'reply',
  nextState: makeState({ messageCount: 1, ...overrides }),
  response:  'Olá!',
})

describe('Idempotency race — processed check outside the lock', () => {
  describe('Given two concurrent handle() calls with the same messageId', () => {
    it('When the first wins the lock and marks processed, Then the second must NOT reprocess the message', async () => {
      const harness = await bootstrap()
      const { service, agent, notifier } = harness

      const agent1Done = deferred<Result<AgentOutcome, never>>()

      // First call's agent.process hangs until we resolve it; this gives the
      // second call time to reach acquire() and queue on the lock.
      ;(agent.process as jest.Mock)
        .mockImplementationOnce(() => agent1Done.promise)
        .mockImplementationOnce(async () => ok(REPLY_OUTCOME()))

      const inbound = makeInboundMessage()

      const p1 = service.handle(inbound)
      await flushMicrotasks()
      const p2 = service.handle(inbound)
      await flushMicrotasks()
      await flushMicrotasks()

      agent1Done.resolve(ok(REPLY_OUTCOME()))

      await p1
      await p2

      expect(agent.process).toHaveBeenCalledTimes(1)
      expect(notifier.reply).toHaveBeenCalledTimes(1)
    })
  })
})

describe('runCriticalSection executes without a lock on UNAVAILABLE', () => {
  describe('Given lock.acquire returns { reason: UNAVAILABLE }', () => {
    it('When handle is called, Then the critical section must NOT run and an error is surfaced', async () => {
      const unavailableLock = {
        acquire: jest.fn().mockResolvedValue({
          reason:   LockFailureReason.UNAVAILABLE,
          attempts: 1,
          waitMs:   0,
        }),
      } as unknown as jest.Mocked<ConversationLock>

      const { service, agent, notifier, stateRepo } = await bootstrap({ lock: unavailableLock })

      const result = await service.handle(makeInboundMessage())

      expect(result.isErr()).toBe(true)
      expect(agent.process).not.toHaveBeenCalled()
      expect(notifier.reply).not.toHaveBeenCalled()
      expect(stateRepo.save).not.toHaveBeenCalled()
      expect(stateRepo.markProcessed).not.toHaveBeenCalled()
    })
  })

  describe('Given lock.acquire returns { reason: CONTENDED }', () => {
    it('When handle is called, Then err MESSAGE_BUSY is returned', async () => {
      const contendedLock = {
        acquire: jest.fn().mockResolvedValue({
          reason:   LockFailureReason.CONTENDED,
          attempts: 3,
          waitMs:   500,
        }),
      } as unknown as jest.Mocked<ConversationLock>

      const { service, agent } = await bootstrap({ lock: contendedLock })

      const result = await service.handle(makeInboundMessage())

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('MESSAGE_BUSY')
      expect(agent.process).not.toHaveBeenCalled()
    })
  })
})

describe('handleReady forwards undefined customerName to generate()', () => {
  describe('Given a booking is confirmed without customerName in state', () => {
    it('When generate() is invoked, Then customerName is an empty string — never undefined', async () => {
      const harness = await bootstrap()
      const { service, agent, reservationAPI } = harness

      ;(reservationAPI.generate as jest.Mock).mockResolvedValue(
        ok({ token: 'tok_abc', expiresAt: new Date('2030-01-01T12:00:00Z') }),
      )

      const bookingOutcome: AgentOutcome = {
        kind:      'booking',
        nextState: makeState({
          step:         'READY',
          checkIn:      '2030-10-10',
          checkOut:     '2030-10-15',
          guests:       2,
          customerName: undefined,
          messageCount: 3,
        }),
      }

      ;(agent.process as jest.Mock).mockResolvedValue(ok(bookingOutcome))

      await service.handle(makeInboundMessage())

      expect(reservationAPI.generate).toHaveBeenCalledTimes(1)
      const [command] = (reservationAPI.generate as jest.Mock).mock.calls[0]
      expect(command.customerName).toBeDefined()
      expect(typeof command.customerName).toBe('string')
      expect(command.customerName).toBe('')
    })
  })

  describe('Given a booking is confirmed WITH customerName in state', () => {
    it('When generate() is invoked, Then the actual customerName is passed through unchanged', async () => {
      const harness = await bootstrap()
      const { service, agent, reservationAPI } = harness

      ;(reservationAPI.generate as jest.Mock).mockResolvedValue(
        ok({ token: 'tok_abc', expiresAt: new Date('2030-01-01T12:00:00Z') }),
      )

      const bookingOutcome: AgentOutcome = {
        kind:      'booking',
        nextState: makeState({
          step:         'READY',
          checkIn:      '2030-10-10',
          checkOut:     '2030-10-15',
          guests:       2,
          customerName: 'Maria Silva',
          messageCount: 3,
        }),
      }

      ;(agent.process as jest.Mock).mockResolvedValue(ok(bookingOutcome))

      await service.handle(
        makeInboundMessage({ messageId: 'SM_WITH_NAME', to: DEFAULT_WHATSAPP_TO, from: `whatsapp:${DEFAULT_PHONE}` }),
      )

      const [command] = (reservationAPI.generate as jest.Mock).mock.calls[0]
      expect(command.customerName).toBe('Maria Silva')
    })
  })
})
