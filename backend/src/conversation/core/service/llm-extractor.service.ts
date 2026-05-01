import Anthropic from '@anthropic-ai/sdk'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@/common/config'
import { err, ok } from 'neverthrow'
import { 
  ConversationContentBlock, 
  ConversationMessage, 
  ConversationState 
} from '@/conversation/core/contract'
import { CONFIRM_BOOKING_TOOL } from '@/conversation/infra'
import { buildSystemPrompt } from '../prompts'
import { ConversationDomainErrors as DomainError } from '../errors'
import { MAX_HISTORY } from '../limits'
import { formatISODate } from '../dates-validator'

type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content: string }

type ExtractedToolUse = { id: string; name: string; input: unknown }

@Injectable()
export class LlmExtractorService {
  private readonly logger = new Logger(LlmExtractorService.name)
  private static LLM_TIMEOUT_MS = 10_000
  private readonly client: Anthropic
  
  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({ apiKey: this.config.get('anthropicApiKey') })
  }
  
  async handle(state: ConversationState, messages: ConversationMessage[]) {
     try {
        const today = formatISODate(new Date(), 'America/Sao_Paulo')
        const response = await this.client.messages.create(
          {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: buildSystemPrompt(state, today),
            tools: [CONFIRM_BOOKING_TOOL],
            messages: messages as Anthropic.MessageParam[],
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

  extractToolUse(response: Anthropic.Message): ExtractedToolUse | undefined {
    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => 
        b.type === 'tool_use' && 
        b.name === CONFIRM_BOOKING_TOOL.name,
    )
    
    if (!toolUse) return undefined
    
    return {
      id: toolUse.id,
      name: toolUse.name,
      input: toolUse.input
    }
  }

  extractText(response: Anthropic.Message): string {
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  }

  appendToHistory(
    history: ConversationMessage[],
    userMessage: string,
    assistantResponse: Anthropic.Message,
  ): ConversationMessage[] {
    const updated: ConversationMessage[] = [
      ...this.appendUserBlock(history, { type: 'text', text: userMessage }),
      { role: 'assistant', content: assistantResponse.content as ConversationContentBlock[] },
    ]

    if (updated.length <= MAX_HISTORY) return updated

    const trimmed = updated.slice(-MAX_HISTORY)
    return trimmed[0].role === 'assistant' ? trimmed.slice(1) : trimmed
  }

  // Anthropic requires strict user/assistant alternation. When the trailing
  // turn is already `user`, merge the block into it instead of starting a new
  // one — otherwise the next API call gets two consecutive `user` turns and
  // fails.
  appendUserBlock(
    history: ConversationMessage[],
    block: UserContentBlock,
  ): ConversationMessage[] {
    const last = history[history.length - 1]

    if (last?.role !== 'user') {
      return [...history, { role: 'user', content: [block] }]
    }

    return [
      ...history.slice(0, -1),
      { role: 'user', content: [...last.content, block] },
    ]
  }
}