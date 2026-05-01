import { Test, TestingModule } from '@nestjs/testing'
import { ok } from 'neverthrow'
import type Anthropic from '@anthropic-ai/sdk'

import { ConversationAgentService } from '../../core/service/conversation-agent.service'
import { LlmExtractorService } from '../../core/service/llm-extractor.service'
import type { ConversationState } from '../../core/contract'
import {
  DEFAULT_PHONE,
  DEFAULT_STAY_ID,
  makeState,
  makeLlmToolUseResponse,
  makeLlmTextResponse,
} from '../fixture/agent'

// Frozen well after the hard-coded future dates and well after the hard-coded
// past date used below, so date-sensitive assertions stay stable.
const FROZEN_NOW = new Date('2026-05-01T12:00:00.000Z')

describe('ConversationAgentService', () => {
  let agent: ConversationAgentService
  let llm:   jest.Mocked<LlmExtractorService>

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW)
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(async () => {
    llm = { handle: jest.fn() } as unknown as jest.Mocked<LlmExtractorService>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationAgentService,
        { provide: LlmExtractorService, useValue: llm },
      ],
    }).compile()

    agent = module.get<ConversationAgentService>(ConversationAgentService)
  })

  describe('tool_use orphan + context loss on incomplete confirm_booking', () => {
    describe('Given the LLM returns confirm_booking with only checkIn', () => {
      it('When agent.process is called, Then err.nextState carries the partial extraction and a synthetic tool_result turn', async () => {
        const toolUseId = 'toolu_partial'
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    toolUseId,
        })))

        const result = await agent.process(
          'meu check-in é dia 10/10',
          makeState({ phone: DEFAULT_PHONE, stayId: DEFAULT_STAY_ID }),
        )

        expect(result.isErr()).toBe(true)
        const error = result._unsafeUnwrapErr() as unknown as {
          code: string
          missing: string[]
          nextState?: ConversationState
        }
        expect(error.code).toBe('CONFIRM_BOOKING_INCOMPLETE')
        expect(error.nextState).toBeDefined()
        const next = error.nextState!

        expect(next.checkIn).toBe('2030-10-10')

        const history = next.messageHistory
        expect(history).toEqual(expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'meu check-in é dia 10/10' }),
        ]))

        const assistantTurn = history.find(
          (m: Anthropic.MessageParam) =>
            m.role === 'assistant'
            && Array.isArray(m.content)
            && m.content.some((b: any) => b.type === 'tool_use' && b.id === toolUseId),
        )
        expect(assistantTurn).toBeDefined()

        const toolResultTurn = history.find(
          (m: Anthropic.MessageParam) =>
            m.role === 'user'
            && Array.isArray(m.content)
            && m.content.some(
              (b: any) =>
                b.type === 'tool_result'
                && b.tool_use_id === toolUseId
                && b.is_error === true,
            ),
        )
        expect(toolResultTurn).toBeDefined()
      })
    })

    describe('Given the prior turn was an incomplete confirm_booking', () => {
      it('When agent.process is called again, Then the messages forwarded to the LLM include the synthetic tool_result', async () => {
        const toolUseId = 'toolu_followup'
        llm.handle.mockResolvedValueOnce(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    toolUseId,
        })))

        const first = await agent.process('check-in 10/10', makeState())
        expect(first.isErr()).toBe(true)
        const nextState = (first._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState

        llm.handle.mockResolvedValueOnce(ok(makeLlmTextResponse('Certo, e o check-out?')))
        await agent.process('saio no dia 15', nextState)

        expect(llm.handle).toHaveBeenCalledTimes(2)
        const [, messagesArg] = llm.handle.mock.calls[1]

        const hasToolResult = (messagesArg as Anthropic.MessageParam[]).some(
          m =>
            m.role === 'user'
            && Array.isArray(m.content)
            && m.content.some(
              (b: any) =>
                b.type === 'tool_result'
                && b.tool_use_id === toolUseId,
            ),
        )
        expect(hasToolResult).toBe(true)
      })
    })
  })

  describe('messageCount does not increment on incomplete confirm_booking', () => {
    describe('Given messageCount is 5', () => {
      it('When the LLM returns an incomplete tool_use, Then err.nextState.messageCount is 6', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    'toolu_count',
        })))

        const result = await agent.process('oi', makeState({ messageCount: 5 }))

        expect(result.isErr()).toBe(true)
        const error = result._unsafeUnwrapErr() as unknown as { nextState: ConversationState }
        expect(error.nextState?.messageCount).toBe(6)
      })
    })

    describe('Given messageCount is 6 and every turn comes back incomplete', () => {
      it('When three consecutive incomplete turns occur, Then the third trips MESSAGE_LIMIT_EXCEEDED', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    'toolu_limit',
        })))

        let state: ConversationState = makeState({ messageCount: 6 })

        const r1 = await agent.process('oi', state)
        expect(r1.isErr()).toBe(true)
        state = (r1._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState
        expect(state.messageCount).toBe(7)

        const r2 = await agent.process('oi', state)
        expect(r2.isErr()).toBe(true)
        state = (r2._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState
        expect(state.messageCount).toBe(8)

        const r3 = await agent.process('oi', state)
        expect(r3.isErr()).toBe(true)
        expect(r3._unsafeUnwrapErr().code).toBe('MESSAGE_LIMIT_EXCEEDED')
      })
    })
  })

  // The Anthropic SDK rejects two consecutive `user` turns. Since the
  // synthetic tool_result is a `user` turn, the next inbound guest message
  // must merge into that same turn instead of starting a new one.
  describe('Strict user/assistant alternation across turns', () => {
    const isUserOrAssistant = (m: Anthropic.MessageParam) => m.role === 'user' || m.role === 'assistant'

    const assertAlternation = (history: Anthropic.MessageParam[]) => {
      for (let i = 0; i < history.length - 1; i++) {
        expect(isUserOrAssistant(history[i])).toBe(true)
        expect(history[i].role).not.toBe(history[i + 1].role)
      }
    }

    describe('Given the previous turn ended with a synthetic tool_result (user)', () => {
      it('When a new guest message arrives, Then it is merged into the trailing user turn — no two user-in-a-row', async () => {
        const toolUseId = 'toolu_alt_a'

        llm.handle.mockResolvedValueOnce(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    toolUseId,
        })))
        const r1 = await agent.process('check-in 10/10', makeState())
        const stateAfterIncomplete = (r1._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState

        const tail = stateAfterIncomplete.messageHistory[stateAfterIncomplete.messageHistory.length - 1]
        expect(tail.role).toBe('user')

        llm.handle.mockResolvedValueOnce(ok(makeLlmTextResponse('certo, e o check-out?')))
        await agent.process('saio dia 15', stateAfterIncomplete)

        const [, sentMessages] = llm.handle.mock.calls[1] as [unknown, Anthropic.MessageParam[]]
        assertAlternation(sentMessages)

        const lastUser = sentMessages[sentMessages.length - 1]
        expect(lastUser.role).toBe('user')
        expect(Array.isArray(lastUser.content)).toBe(true)
        const blocks = lastUser.content as any[]
        expect(blocks).toEqual(expect.arrayContaining([
          expect.objectContaining({ type: 'tool_result', tool_use_id: toolUseId }),
          expect.objectContaining({ type: 'text', text: 'saio dia 15' }),
        ]))
      })

      it('When the second turn finishes, Then the persisted history alternates strictly', async () => {
        const toolUseId = 'toolu_alt_a_persist'
        llm.handle.mockResolvedValueOnce(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    toolUseId,
        })))
        const r1 = await agent.process('check-in 10/10', makeState())
        const after1 = (r1._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState

        llm.handle.mockResolvedValueOnce(ok(makeLlmTextResponse('certo, e o check-out?')))
        const r2 = await agent.process('saio dia 15', after1)
        expect(r2.isOk()).toBe(true)
        const after2 = r2._unsafeUnwrap().nextState

        assertAlternation(after2.messageHistory)
        expect(after2.messageHistory[0].role).toBe('user')
        expect(after2.messageHistory[after2.messageHistory.length - 1].role).toBe('assistant')
      })
    })

    describe('Given an assistant turn carries a tool_use block', () => {
      it('When the agent reports an incomplete confirm, Then the next history entry is a user(tool_result), not another assistant', async () => {
        const toolUseId = 'toolu_alt_b'
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10' },
          id:    toolUseId,
        })))

        const result = await agent.process('confirma', makeState())
        const next = (result._unsafeUnwrapErr() as unknown as { nextState: ConversationState }).nextState

        const history = next.messageHistory
        const idx = history.findIndex(
          m =>
            m.role === 'assistant'
            && Array.isArray(m.content)
            && (m.content as any[]).some(b => b.type === 'tool_use' && b.id === toolUseId),
        )
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx + 1).toBeLessThan(history.length)
        expect(history[idx + 1].role).toBe('user')
        expect(Array.isArray(history[idx + 1].content)).toBe(true)
        expect(history[idx + 1].content as any[]).toEqual(
          expect.arrayContaining([expect.objectContaining({
            type: 'tool_result',
            tool_use_id: toolUseId,
          })]),
        )
      })
    })

    describe('Given the history slides past MAX_HISTORY entries', () => {
      it('When a new turn is appended, Then trimming preserves alternation starting with user', async () => {
        const history: Anthropic.MessageParam[] = []
        for (let i = 0; i < 20; i++) {
          history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` })
        }

        llm.handle.mockResolvedValueOnce(ok(makeLlmTextResponse('resp')))
        const result = await agent.process('nova', makeState({ messageHistory: history, messageCount: 5 }))

        expect(result.isOk()).toBe(true)
        const next = result._unsafeUnwrap().nextState
        expect(next.messageHistory).toHaveLength(20)
        expect(next.messageHistory[0].role).toBe('user')
        assertAlternation(next.messageHistory)
      })
    })
  })

  describe('confirm_booking has no semantic validation of dates/guests', () => {
    const expectNotABooking = (result: { isOk: () => boolean; isErr: () => boolean; _unsafeUnwrap: () => any }) => {
      if (result.isOk()) {
        expect(result._unsafeUnwrap().kind).not.toBe('booking')
        expect(result._unsafeUnwrap().nextState.step).not.toBe('READY')
      } else {
        expect(result.isErr()).toBe(true)
      }
    }

    describe('Given checkIn is a non-date string', () => {
      it('When process runs, Then the outcome is not a booking and state does not advance to READY', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: 'banana', checkOut: '2030-10-15', guests: 2 },
        })))

        const result = await agent.process('uh?', makeState())
        expectNotABooking(result)
      })
    })

    describe('Given checkOut is before checkIn', () => {
      it('When process runs, Then the inverted range is rejected', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-05-15', checkOut: '2030-05-10', guests: 2 },
        })))

        const result = await agent.process('confirma', makeState())
        expectNotABooking(result)
      })
    })

    describe('Given checkIn is in the past relative to today', () => {
      it('When process runs, Then the past date is rejected', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2020-01-01', checkOut: '2020-01-05', guests: 2 },
        })))

        const result = await agent.process('confirma', makeState())
        expectNotABooking(result)
      })
    })

    describe('Given guests is zero', () => {
      it('When process runs, Then guests=0 is rejected', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10', checkOut: '2030-10-15', guests: 0 },
        })))

        const result = await agent.process('confirma', makeState())
        expectNotABooking(result)
      })
    })

    describe('Given guests is absurdly high', () => {
      it('When guests = 150, Then the value is rejected against a sane max (<= 20)', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10', checkOut: '2030-10-15', guests: 150 },
        })))

        const result = await agent.process('confirma', makeState())
        expectNotABooking(result)
      })
    })

    describe('Given all fields are semantically valid', () => {
      it('When process runs, Then kind=booking and step=READY', async () => {
        llm.handle.mockResolvedValue(ok(makeLlmToolUseResponse({
          input: { checkIn: '2030-10-10', checkOut: '2030-10-15', guests: 2 },
        })))

        const result = await agent.process('confirma', makeState())

        expect(result.isOk()).toBe(true)
        const outcome = result._unsafeUnwrap()
        expect(outcome.kind).toBe('booking')
        expect(outcome.nextState.step).toBe('READY')
      })
    })
  })
})
