import { Test, TestingModule } from '@nestjs/testing'
import { GenerateLink, ReservationTokenService } from '@/reservation/core/service'
import { ReservationSessionRepository } from '@/reservation/persist'
import { ConfigService } from '@/common/config'
import { EVENT_BUS } from '@/common/messaging'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'
import { createHmac } from 'crypto'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
}))

describe('Scenario: Generate Reservation Link by a Staff Member', () => {
  let service: GenerateLink
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  const SECRET = 'test-secret-with-at-least-32-characters'

  beforeEach(async () => {
    sessionRepo = {
      save: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateLink,
        ReservationTokenService,
        {
          provide: ReservationSessionRepository,
          useValue: sessionRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'frontendUrl') return 'http://localhost:3000'
              return SECRET
            }),
          },
        },
        {
          provide: EVENT_BUS,
          useClass: FakeEventBus,
        },
      ],
    }).compile()

    service = module.get<GenerateLink>(GenerateLink)
  })

  describe('Given that a staff member wants to send a reservation link to a customer', () => {
    const command = {
      stayId: 'stay-uuid',
      stayName: 'Grand Hotel',
      customerName: 'John Doe',
      checkIn: new Date('2030-12-01'),
      checkOut: new Date('2030-12-05'),
      guests: 2,
      staffId: 'staff-uuid',
    }

    it('When they request the link generation, then the system must create a new active session in the database', async () => {
      sessionRepo.save.mockResolvedValue({
        id: 'session-uuid',
        stayId: command.stayId,
        stayName: command.stayName,
        checkIn: command.checkIn,
        checkOut: command.checkOut,
        customer: { name: command.customerName },
        expiresAt: new Date(),
      } as any)

      await service.handle(command)

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stayId: command.stayId,
          status: 'ACTIVE',
          guests: command.guests,
          version: 1,
        })
      )
    })

    it('And the system must return a signed token (HMAC) containing the session ID to ensure integrity', async () => {
      const sessionId = 'session-uuid'
      sessionRepo.save.mockResolvedValue({
        id: sessionId,
        stayId: command.stayId,
        stayName: command.stayName,
        checkIn: command.checkIn,
        checkOut: command.checkOut,
        customer: { name: command.customerName },
        expiresAt: new Date(),
      } as any)

      const result = await service.handle(command)

      if (result.isErr()) throw result.error

      // Verify token format: payload.sig (base64url)
      const [payload, sig] = result.value.token.split('.')
      expect(payload).toBeDefined()
      expect(sig).toBeDefined()

      // Validate signature manually to ensure service used the correct secret
      const expectedSig = createHmac('sha256', SECRET)
        .update(payload)
        .digest('base64url')

      expect(sig).toBe(expectedSig)
      expect(Buffer.from(payload, 'base64url').toString()).toBe(sessionId)
    })

    it('And the generated session must have an expiration of exactly 15 minutes from creation', async () => {
      // Mock to capture the object sent to save
      let savedSession: any
      sessionRepo.save.mockImplementation(async (session) => {
        savedSession = session
        return { ...session, id: '123' } as any
      })

      const now = new Date()
      jest.useFakeTimers().setSystemTime(now)

      await service.handle(command)

      const fifteenMinutes = 15 * 60 * 1000
      const expectedExpiration = new Date(now.getTime() + fifteenMinutes)
      expect(savedSession.expiresAt.getTime()).toBe(expectedExpiration.getTime())

      jest.useRealTimers()
    })

    it('And it must publish a SESSION_LINK_GENERATED event with the enriched payload', async () => {
      const eventBus = (service as any).eventBus as FakeEventBus
      sessionRepo.save.mockResolvedValue({
        id: 'session-uuid',
        stayId: command.stayId,
        stayName: command.stayName,
        checkIn: command.checkIn,
        checkOut: command.checkOut,
        customer: { name: command.customerName },
        expiresAt: new Date(),
      } as any)

      await service.handle(command)

      const event = eventBus.published.find(e => e.queue === 'session.link_generated')
      expect(event).toBeDefined()
      expect(event?.payload).toEqual(expect.objectContaining({
        sessionId: 'session-uuid',
        stayId: command.stayId,
        stayName: command.stayName,
        customerName: command.customerName,
        checkIn: command.checkIn.toISOString(),
        checkOut: command.checkOut.toISOString(),
        bookingLink: expect.stringMatching(/http:\/\/localhost:3000\/reservation\?token=.+/)
      }))
    })
  })
})