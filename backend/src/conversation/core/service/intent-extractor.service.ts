import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { ConfigService } from '@/common/config'
import { ConversationState } from '../contract/conversation-state'
import { ExtractedIntent, IntentType } from '../contract/intent'
import { getBookingIntentPrompt } from '../prompts/booking-intent.prompt'

interface LLMResponse {
  intent: IntentType
  entities: {
    checkIn?: string
    checkOut?: string
    guests?: number
    customerName?: string
  }
  confidence: number
}

@Injectable()
export class IntentExtractorService {
  private readonly logger = new Logger(IntentExtractorService.name)
  private readonly client: Anthropic

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get('anthropicApiKey'),
    })
  }

  async extract(
    message: string,
    state: ConversationState
  ): Promise<ExtractedIntent> {
    const today = new Date().toISOString().split('T')[0]

    const prompt = getBookingIntentPrompt(message, state, today)

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: '{' }
        ]
      })

      const raw = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')

      const parsed = JSON.parse('{' + raw) as LLMResponse

      return {
        intent: parsed.intent,
        confidence: parsed.confidence,
        entities: {
          checkIn: parsed.entities.checkIn ? new Date(parsed.entities.checkIn) : undefined,
          checkOut: parsed.entities.checkOut ? new Date(parsed.entities.checkOut) : undefined,
          guests: parsed.entities.guests ?? undefined,
          customerName: parsed.entities.customerName ?? undefined
        }
      }
    } catch (error) {
      this.logger.error('LLM extraction failed', error)

      // Fallback seguro — não quebra o fluxo
      return { intent: 'UNKNOWN', confidence: 0, entities: {} }
    }
  }
}