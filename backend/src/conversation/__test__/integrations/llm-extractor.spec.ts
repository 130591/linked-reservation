import { Test, TestingModule } from '@nestjs/testing'
import type Anthropic from '@anthropic-ai/sdk'
import { LlmExtractorService } from '../../core/service/llm-extractor.service'
import { ConfigService } from '@/common/config'
import { CONFIRM_BOOKING_TOOL } from '../../libs'
import type { ConversationMessage } from '../../core/contract'
import { makeState, makeConfigMock } from '../fixture/agent'

const createMock = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}))

describe('Scenario: LLM Extractor', () => {
  let service: LlmExtractorService

  const messages: ConversationMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'Oi' }] },
  ]

  beforeEach(async () => {
    createMock.mockReset()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmExtractorService,
        { provide: ConfigService, useValue: makeConfigMock() },
      ],
    }).compile()

    service = module.get<LlmExtractorService>(LlmExtractorService)
  })

  describe('Given the SDK returns a message', () => {
    it('When handle is called, Then it forwards the raw response wrapped in ok()', async () => {
      const sdkResponse = { id: 'msg_1', type: 'message', content: [] } as unknown as Anthropic.Message
      createMock.mockResolvedValueOnce(sdkResponse)

      const result = await service.handle(makeState(), messages)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(sdkResponse)
    })

    it('When handle is called, Then the create call carries the agreed model, tools, messages and a non-empty system prompt', async () => {
      createMock.mockResolvedValueOnce({ id: 'msg_1', type: 'message', content: [] } as any)

      await service.handle(makeState(), messages)

      expect(createMock).toHaveBeenCalledTimes(1)
      const [params] = createMock.mock.calls[0]
      expect(params).toEqual(expect.objectContaining({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools:      [CONFIRM_BOOKING_TOOL],
        messages,
      }))
      expect(typeof params.system).toBe('string')
      expect(params.system.length).toBeGreaterThan(0)
    })

    it('When handle is called, Then it passes an AbortSignal so the SDK respects the timeout', async () => {
      createMock.mockResolvedValueOnce({ id: 'msg_1', type: 'message', content: [] } as any)

      await service.handle(makeState(), messages)

      const [, options] = createMock.mock.calls[0]
      expect(options.signal).toBeInstanceOf(AbortSignal)
    })

    it('When state has collected fields, Then they are reflected inside the system prompt', async () => {
      createMock.mockResolvedValueOnce({ id: 'msg_1', type: 'message', content: [] } as any)

      await service.handle(
        makeState({ checkIn: '2030-10-10', checkOut: '2030-10-15', guests: 3 }),
        messages,
      )

      const [params] = createMock.mock.calls[0]
      expect(params.system).toContain('2030-10-10')
      expect(params.system).toContain('2030-10-15')
      expect(params.system).toContain('3')
    })
  })

  describe('Given the SDK aborts with a timeout', () => {
    it('When handle is called, Then err LLM_TIMEOUT is returned', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      createMock.mockRejectedValueOnce(abortError)

      const result = await service.handle(makeState(), messages)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toEqual(expect.objectContaining({
        code: 'LLM_TIMEOUT',
      }))
    })
  })

  describe('Given the SDK rejects with a generic error', () => {
    it('When handle is called, Then err LLM_CALL_FAILED is returned carrying the original cause', async () => {
      createMock.mockRejectedValueOnce(new Error('network down'))

      const result = await service.handle(makeState(), messages)

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.code).toBe('LLM_CALL_FAILED')
      expect(error.message).toContain('network down')
    })

    it('When the rejection is not an Error instance, Then err LLM_CALL_FAILED is returned without a cause', async () => {
      createMock.mockRejectedValueOnce('weird reject value')

      const result = await service.handle(makeState(), messages)

      expect(result.isErr()).toBe(true)
      const error = result._unsafeUnwrapErr()
      expect(error.code).toBe('LLM_CALL_FAILED')
      expect(error.message).toBe('LLM call failed')
    })
  })
})
