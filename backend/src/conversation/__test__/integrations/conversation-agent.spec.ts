import { Test, TestingModule } from '@nestjs/testing'
import { ok, err } from 'neverthrow'
import type Anthropic from '@anthropic-ai/sdk'
import { ConversationAgentService } from '../../core/service/conversation-agent.service'
import { LlmExtractorService } from '../../core/service/llm-extractor.service'
import { ConversationDomainErrors as DomainError } from '../../core/errors'
import {
  DEFAULT_PHONE,
  DEFAULT_STAY_ID,
  makeState,
  textReply,
  multiTextReply,
  toolUseResponse,
} from '../fixture/agent'

describe('Scenario: Conversation Agent Turn', () => {
  let agent: ConversationAgentService
  let llm: jest.Mocked<LlmExtractorService>

  beforeEach(async () => {
    llm = { handle: jest.fn() } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationAgentService,
        { provide: LlmExtractorService, useValue: llm },
      ],
    }).compile()

    agent = module.get<ConversationAgentService>(ConversationAgentService)
  })

  describe('Given a fresh conversation', () => {
    it('When initialState is built, Then it starts at INIT with empty history and messageCount 0', () => {
      const state = agent.initialState(DEFAULT_PHONE, DEFAULT_STAY_ID)

      expect(state).toEqual(expect.objectContaining({
        phone:          DEFAULT_PHONE,
        stayId:         DEFAULT_STAY_ID,
        step:           'INIT',
        messageCount:   0,
        messageHistory: [],
      }))
      expect(state.updatedAt).toEqual(expect.any(String))
    })
  })

  describe('Given the LLM replies with plain text', () => {
    it('When process is called, Then it returns a reply outcome and advances the state', async () => {
      llm.handle.mockResolvedValue(ok(textReply('Olá! Quando gostaria de se hospedar?')))

      const result = await agent.process('Oi', makeState())

      expect(result.isOk()).toBe(true)
      const outcome = result._unsafeUnwrap()
      expect(outcome.kind).toBe('reply')
      if (outcome.kind !== 'reply') return
      expect(outcome.response).toBe('Olá! Quando gostaria de se hospedar?')
      expect(outcome.nextState.messageCount).toBe(1)
      expect(outcome.nextState.messageHistory).toHaveLength(2)
      expect(outcome.nextState.messageHistory[0]).toEqual({ role: 'user', content: 'Oi' })
      expect(outcome.nextState.messageHistory[1].role).toBe('assistant')
    })

    it('When text response has multiple text blocks, Then they are concatenated in order', async () => {
      llm.handle.mockResolvedValue(ok(multiTextReply('Parte 1. ', 'Parte 2.')))

      const result = await agent.process('Oi', makeState())

      expect(result.isOk()).toBe(true)
      const outcome = result._unsafeUnwrap()
      if (outcome.kind !== 'reply') throw new Error('expected reply')
      expect(outcome.response).toBe('Parte 1. Parte 2.')
    })
  })

  describe('Given the LLM requests confirm_booking with all required fields', () => {
    it('When process is called, Then it returns a booking outcome in READY step', async () => {
      llm.handle.mockResolvedValue(ok(toolUseResponse({
        checkIn:      '2030-10-10',
        checkOut:     '2030-10-15',
        guests:       2,
        customerName: 'Everton',
      })))

      const result = await agent.process('confirma pra mim', makeState())

      expect(result.isOk()).toBe(true)
      const outcome = result._unsafeUnwrap()
      expect(outcome.kind).toBe('booking')
      expect(outcome.nextState).toEqual(expect.objectContaining({
        step:         'READY',
        checkIn:      '2030-10-10',
        checkOut:     '2030-10-15',
        guests:       2,
        customerName: 'Everton',
      }))
    })

    it('When tool_use omits customerName, Then the existing state value is preserved', async () => {
      llm.handle.mockResolvedValue(ok(toolUseResponse({
        checkIn:  '2030-10-10',
        checkOut: '2030-10-15',
        guests:   2,
      })))

      const result = await agent.process('confirma', makeState({ customerName: 'Maria' }))

      expect(result._unsafeUnwrap().nextState.customerName).toBe('Maria')
    })
  })

  describe('Given confirm_booking is called with missing required fields', () => {
    it('When only checkIn is missing, Then err CONFIRM_BOOKING_INCOMPLETE lists [checkIn]', async () => {
      llm.handle.mockResolvedValue(ok(toolUseResponse({
        checkOut: '2030-10-15',
        guests:   2,
      })))

      const result = await agent.process('confirma', makeState())

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toEqual(expect.objectContaining({
        code:    'CONFIRM_BOOKING_INCOMPLETE',
        missing: ['checkIn'],
      }))
    })

    it('When all fields are missing, Then err lists [checkIn, checkOut, guests] in canonical order', async () => {
      llm.handle.mockResolvedValue(ok(toolUseResponse({})))

      const result = await agent.process('confirma', makeState())

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toEqual(expect.objectContaining({
        code:    'CONFIRM_BOOKING_INCOMPLETE',
        missing: ['checkIn', 'checkOut', 'guests'],
      }))
    })
  })

  describe('Given the conversation has hit the message limit', () => {
    it('When process is called, Then err MESSAGE_LIMIT_EXCEEDED is returned without invoking the LLM', async () => {
      const result = await agent.process('oi', makeState({ messageCount: 8 }))

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toEqual(expect.objectContaining({
        code:  'MESSAGE_LIMIT_EXCEEDED',
        count: 8,
        max:   8,
      }))
      expect(llm.handle).not.toHaveBeenCalled()
    })
  })

  describe('Given the LLM call fails', () => {
    it('When a timeout occurs, Then LLM_TIMEOUT bubbles up unchanged', async () => {
      llm.handle.mockResolvedValue(err(DomainError.LLM_TIMEOUT()))

      const result = await agent.process('oi', makeState())

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('LLM_TIMEOUT')
    })

    it('When the SDK rejects, Then LLM_CALL_FAILED bubbles up with the cause in the message', async () => {
      llm.handle.mockResolvedValue(err(DomainError.LLM_CALL_FAILED('socket hang up')))

      const result = await agent.process('oi', makeState())

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.code).toBe('LLM_CALL_FAILED')
      expect(error.message).toContain('socket hang up')
    })
  })

  describe('Given a long conversation approaching the history window', () => {
    it('When appending would exceed MAX_HISTORY (20), Then the oldest pair is trimmed keeping turn alignment', async () => {
      llm.handle.mockResolvedValue(ok(textReply('resposta')))

      const history: Anthropic.MessageParam[] = []
      for (let i = 0; i < 20; i++) {
        history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `m${i}` })
      }

      const result = await agent.process('nova', makeState({ messageHistory: history, messageCount: 5 }))

      expect(result.isOk()).toBe(true)
      const outcome = result._unsafeUnwrap()
      expect(outcome.nextState.messageHistory).toHaveLength(20)
      expect(outcome.nextState.messageHistory[0].role).toBe('user')
    })
  })
})
