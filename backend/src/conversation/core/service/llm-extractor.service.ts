import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@/common/config'
import { err, ok } from 'neverthrow'
import { ConversationState } from '../contract'
import { CONFIRM_BOOKING_TOOL } from '@/conversation/infra'
import { buildSystemPrompt } from '../prompts'
import { ConversationDomainErrors as DomainError } from '../errors'


@Injectable()
export class LlmExtractorService {
  private readonly logger = new Logger(LlmExtractorService.name)
  private static LLM_TIMEOUT_MS = 10_000
  private readonly client: Anthropic
  
  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({ apiKey: this.config.get('anthropicApiKey') })
  }
  
  async handle(state: ConversationState, messages: Anthropic.MessageParam[]) {
     try {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
        const response = await this.client.messages.create(
          {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: buildSystemPrompt(state, today),
            tools: [CONFIRM_BOOKING_TOOL],
            messages,
          },
          { signal: AbortSignal.timeout(LlmExtractorService.LLM_TIMEOUT_MS) },
        )
        return ok(response)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          this.logger.warn({ event: 'llm.timeout' })
          return err(DomainError.LLM_TIMEOUT())
        }
        this.logger.error('LLM call failed', error)
        const cause = error instanceof Error ? error.message : undefined
        return err(DomainError.LLM_CALL_FAILED(cause))
      }
  }
}