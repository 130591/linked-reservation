import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { err, ok, Result } from 'neverthrow'
import { ConversationDomainErrors as DomainError } from '@/conversation/core/errors'
import { ConversationState } from '../contract/conversation-state'
import { LlmExtractorService } from './llm-extractor.service'
import { MAX_GUESTS, MAX_HISTORY, MAX_MESSAGES } from '../limits'

interface ConfirmBookingInput {
  checkIn?: string
  checkOut?: string
  guests?: number
  customerName?: string
}

export type AgentOutcome =
  | { kind: 'reply';   nextState: ConversationState; response: string }
  | { kind: 'booking'; nextState: ConversationState }

export type ConversationAgentError = ReturnType<
  | typeof DomainError.LLM_TIMEOUT
  | typeof DomainError.LLM_CALL_FAILED
  | typeof DomainError.MESSAGE_LIMIT_EXCEEDED
  | typeof DomainError.CONFIRM_BOOKING_INCOMPLETE
  | typeof DomainError.BOOKING_FIELDS_INVALID
>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HOTEL_TZ = 'America/Sao_Paulo'

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
      return this.handleConfirmBooking(
        toolUse.input as ConfirmBookingInput,
        toolUse.id,
        updatedState,
      )
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
    return appendUserBlock(history, { type: 'text', text: userMessage })
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
    toolUseId: string,
    state: ConversationState,
  ): Result<AgentOutcome, ConversationAgentError> {
    const missing = this.findMissing(input)
    const invalid = this.findInvalid(input)

    if (missing.length > 0 || invalid.length > 0) {
      const reason = missing.length > 0
        ? `Missing fields: ${missing.join(', ')}`
        : `Invalid fields: ${invalid.join(', ')}`

      // Echo a tool_result back to the model so a follow-up turn can recover
      // from the failed tool_use, and keep any fields it did extract correctly.
      const partialState: ConversationState = {
        ...state,
        checkIn:      this.preserveValid(input.checkIn,  state.checkIn,  invalid.includes('checkIn')),
        checkOut:     this.preserveValid(input.checkOut, state.checkOut, invalid.includes('checkOut')),
        guests:       invalid.includes('guests') ? state.guests : (input.guests ?? state.guests),
        customerName: input.customerName ?? state.customerName,
        messageHistory: appendUserBlock(state.messageHistory, {
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: true,
          content: reason,
        }),
      }

      if (missing.length > 0) {
        this.logger.warn({ event: 'confirm_booking.incomplete', input, missing })
        return err(DomainError.CONFIRM_BOOKING_INCOMPLETE(missing, partialState))
      }
      this.logger.warn({ event: 'confirm_booking.invalid', input, invalid })
      return err(DomainError.BOOKING_FIELDS_INVALID(invalid, partialState))
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

  private findMissing(input: ConfirmBookingInput): Array<'checkIn' | 'checkOut' | 'guests'> {
    const missing: Array<'checkIn' | 'checkOut' | 'guests'> = []
    if (!input.checkIn)  missing.push('checkIn')
    if (!input.checkOut) missing.push('checkOut')
    if (!input.guests)   missing.push('guests')
    return missing
  }

  private findInvalid(input: ConfirmBookingInput): string[] {
    const invalid = new Set<string>()
    const today = todayInTz(HOTEL_TZ)

    const ciOk = !!input.checkIn  && ISO_DATE.test(input.checkIn)
    const coOk = !!input.checkOut && ISO_DATE.test(input.checkOut)

    if (input.checkIn  && !ciOk) invalid.add('checkIn')
    if (input.checkOut && !coOk) invalid.add('checkOut')

    if (ciOk && input.checkIn! < today) invalid.add('checkIn')
    if (ciOk && coOk && input.checkOut! <= input.checkIn!) invalid.add('checkOut')

    if (input.guests !== undefined && (input.guests < 1 || input.guests > MAX_GUESTS)) {
      invalid.add('guests')
    }

    return [...invalid]
  }

  private preserveValid(
    incoming: string | undefined,
    existing: string | undefined,
    incomingInvalid: boolean,
  ): string | undefined {
    if (incomingInvalid) return existing
    return incoming ?? existing
  }

  private appendToHistory(
    history: Anthropic.MessageParam[],
    userMessage: string,
    assistantResponse: Anthropic.Message,
  ): Anthropic.MessageParam[] {
    const withUser = appendUserBlock(history, { type: 'text', text: userMessage })
    const updated: Anthropic.MessageParam[] = [
      ...withUser,
      { role: 'assistant', content: assistantResponse.content },
    ]

    if (updated.length > MAX_HISTORY) {
      const excess = updated.length - MAX_HISTORY
      return updated.slice(excess % 2 === 0 ? excess : excess + 1)
    }

    return updated
  }
}

type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content: string }

// Anthropic requires strict user/assistant alternation. When the trailing
// turn is already `user`, merge the block into it instead of starting a new
// one — otherwise the next API call gets two consecutive `user` turns and
// fails.
function appendUserBlock(
  history: Anthropic.MessageParam[],
  block: UserContentBlock,
): Anthropic.MessageParam[] {
  const last = history[history.length - 1]
  if (last && last.role === 'user') {
    const existing = Array.isArray(last.content)
      ? last.content
      : [{ type: 'text' as const, text: last.content }]
    return [
      ...history.slice(0, -1),
      { role: 'user', content: [...existing, block] as Anthropic.MessageParam['content'] },
    ]
  }
  return [
    ...history,
    {
      role: 'user',
      content: block.type === 'text' ? block.text : ([block] as Anthropic.MessageParam['content']),
    },
  ]
}

// `en-CA` formats as YYYY-MM-DD, which sorts lexicographically.
function todayInTz(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}
