import { Test, TestingModule } from '@nestjs/testing'

import { LlmExtractorService } from '../../core/service/llm-extractor.service'
import { ConfigService } from '@/common/config'
import type { ConversationMessage } from '../../core/contract'
import { makeState } from '../fixture/agent'

const createMock = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}))

describe('LlmExtractorService', () => {
  let service: LlmExtractorService

  const messages: ConversationMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'Oi' }] },
  ]

  beforeEach(async () => {
    createMock.mockReset()
    createMock.mockResolvedValue({ id: 'msg_1', type: 'message', content: [] } as any)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmExtractorService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('fake-api-key') },
        },
      ],
    }).compile()

    service = module.get<LlmExtractorService>(LlmExtractorService)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('today is derived in UTC instead of the hotel timezone', () => {
    describe('Given system time is 2026-05-10 23:30 BRT (2026-05-11 02:30 UTC)', () => {
      it('When handle() runs, Then the system prompt carries today="2026-05-10", not 2026-05-11', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-11T02:30:00.000Z'))

        await service.handle(makeState(), messages)

        const [params] = createMock.mock.calls[0]
        expect(typeof params.system).toBe('string')
        expect(params.system).toContain('2026-05-10')
        expect(params.system).not.toContain('2026-05-11')
      })
    })

    describe('Given system time is firmly inside the same UTC and BRT day', () => {
      it('When handle() runs, Then the system prompt matches the local date', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-05-10T18:00:00.000Z'))

        await service.handle(makeState(), messages)

        const [params] = createMock.mock.calls[0]
        expect(params.system).toContain('2026-05-10')
      })
    })
  })
})
