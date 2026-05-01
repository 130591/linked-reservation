import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { err, ok, Result } from 'neverthrow'
import { ConversationDomainErrors as DomainError } from '@/conversation/core/errors'
import { ConversationState } from '../contract/conversation-state'
import { LlmExtractorService } from './llm-extractor.service'
import { ConfigService } from '@/common/config'
import { formatISODate, isBeforeISODate, isSameOrBeforeISODate, parseISODate } from '../../libs/dates-validator'

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

const HOTEL_TZ = 'America/Sao_Paulo'

@Injectable()
export class ConversationAgentService {
  private readonly logger = new Logger(ConversationAgentService.name)

  constructor(
    private readonly llmExtractor: LlmExtractorService,
    private readonly config: ConfigService,
  ) {}

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
    const maxMessages = this.config.get('conversation.maxMessages')
    if (state.messageCount >= maxMessages) {
      return err(DomainError.MESSAGE_LIMIT_EXCEEDED(state.messageCount, maxMessages))
    }

    const messages = this.llmExtractor.appendUserBlock(state.messageHistory, { type: 'text', text: userMessage })
    const responseResult = await this.llmExtractor.handle(state, messages)

    if (responseResult.isErr()) return err(responseResult.error)

    const response = responseResult.value
    const toolUse  = this.llmExtractor.extractToolUse(response)

    const updatedState: ConversationState = {
      ...state,
      messageCount: state.messageCount + 1,
      messageHistory: this.llmExtractor.appendToHistory(state.messageHistory, userMessage, response),
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
      response: this.llmExtractor.extractText(response),
    })
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
        messageHistory: this.llmExtractor.appendUserBlock(state.messageHistory, {
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
    const today = formatISODate(new Date(), HOTEL_TZ)

    const checkInOk  = !!input.checkIn  && parseISODate(input.checkIn)  !== null
    const checkOutOk = !!input.checkOut && parseISODate(input.checkOut) !== null

    if (input.checkIn  && !checkInOk)  invalid.add('checkIn')
    if (input.checkOut && !checkOutOk) invalid.add('checkOut')

    if (checkInOk && isBeforeISODate(input.checkIn!, today)) invalid.add('checkIn')
    if (checkInOk && checkOutOk && isSameOrBeforeISODate(input.checkOut!, input.checkIn!)) {
      invalid.add('checkOut')
    }

    const maxGuests = this.config.get('conversation.maxGuests')
    if (input.guests !== undefined && (input.guests < 1 || input.guests > maxGuests)) {
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
}
