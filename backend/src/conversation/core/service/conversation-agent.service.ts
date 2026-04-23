import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { err, ok, Result } from 'neverthrow'
import { ConversationDomainErrors as DomainError } from '@/conversation/core/errors'
import { ConversationState } from '../contract/conversation-state'
import { LlmExtractorService } from './llm-extractor.service'

const MAX_MESSAGES   = 8
const MAX_HISTORY    = 20

interface ConfirmBookingInput {
  checkIn: string
  checkOut: string
  guests: number
  customerName?: string
}

/**
 * Successful outcome of an agent turn.
 * Explicitly distinguishes the two success paths:
 * - `kind: 'reply'`   → the agent wants to respond to the user
 * - `kind: 'booking'` → the agent has all required data and wants to confirm the booking
 */
export type AgentOutcome =
  | { kind: 'reply';   nextState: ConversationState; response: string }
  | { kind: 'booking'; nextState: ConversationState }

export type ConversationAgentError = ReturnType<
  | typeof DomainError.LLM_TIMEOUT
  | typeof DomainError.LLM_CALL_FAILED
  | typeof DomainError.MESSAGE_LIMIT_EXCEEDED
  | typeof DomainError.CONFIRM_BOOKING_INCOMPLETE
>

@Injectable()
export class ConversationAgentService {
  private readonly logger = new Logger(ConversationAgentService.name)

  constructor(private readonly llmExtractor: LlmExtractorService) {}

  initialState(phone: string, stayId: string): ConversationState {
    return {
      phone,
      stayId,
      step: 'INIT',
      messageCount: 0,
      messageHistory: [],
      updatedAt: new Date().toISOString(),
    }
  }

  async process(
    userMessage: string,
    state: ConversationState,
  ): Promise<Result<AgentOutcome, ConversationAgentError>> {
    if (state.messageCount >= MAX_MESSAGES) {
      return err(DomainError.MESSAGE_LIMIT_EXCEEDED(state.messageCount, MAX_MESSAGES))
    }

    const messages = this.buildMessages(state.messageHistory, userMessage)
    const responseResult = await this.llmExtractor.handle(state, messages)
    
    if (responseResult.isErr()) return err(responseResult.error)

    const response = responseResult.value
    const toolUse  = this.extractToolUse(response)

    const updatedState: ConversationState = {
      ...state,
      messageCount: state.messageCount + 1,
      messageHistory: this.appendToHistory(state.messageHistory, userMessage, response),
      updatedAt: new Date().toISOString(),
    }

    if (toolUse) {
      return this.handleConfirmBooking(toolUse.input as ConfirmBookingInput, updatedState)
    }

    return ok({
      kind: 'reply',
      nextState: updatedState,
      response: this.extractText(response),
    })
  }

  private buildMessages(
    history: Anthropic.MessageParam[],
    userMessage: string,
  ): Anthropic.MessageParam[] {
    return [...history, { role: 'user', content: userMessage }]
  }

  private extractText(response: Anthropic.Message): string {
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  }

  private extractToolUse(response: Anthropic.Message): Anthropic.ToolUseBlock | undefined {
    return response.content
      .find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'confirm_booking')
  }

  private handleConfirmBooking(
    input: ConfirmBookingInput,
    state: ConversationState,
  ): Result<AgentOutcome, ConversationAgentError> {
    const missing: Array<'checkIn' | 'checkOut' | 'guests'> = []
    if (!input.checkIn)  missing.push('checkIn')
    if (!input.checkOut) missing.push('checkOut')
    if (!input.guests)   missing.push('guests')

    if (missing.length > 0) {
      this.logger.warn({ event: 'confirm_booking.incomplete', input, missing })
      return err(DomainError.CONFIRM_BOOKING_INCOMPLETE(missing))
    }

    this.logger.log({ event: 'confirm_booking.ready', input })

    return ok({
      kind: 'booking',
      nextState: {
        ...state,
        step: 'READY',
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        customerName: input.customerName ?? state.customerName,
      },
    })
  }

  private appendToHistory(
    history: Anthropic.MessageParam[],
    userMessage: string,
    assistantResponse: Anthropic.Message,
  ): Anthropic.MessageParam[] {
    const updated: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user',      content: userMessage },
      { role: 'assistant', content: assistantResponse.content },
    ]

    if (updated.length > MAX_HISTORY) {
      const excess = updated.length - MAX_HISTORY
      return updated.slice(excess % 2 === 0 ? excess : excess + 1)
    }

    return updated
  }
}