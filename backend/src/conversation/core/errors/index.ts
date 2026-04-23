
export interface MessageLimitExceededError {
  readonly code: 'MESSAGE_LIMIT_EXCEEDED'
  readonly message: string
  readonly count: number
  readonly max: number
}

export interface ConfirmBookingIncompleteError {
  readonly code: 'CONFIRM_BOOKING_INCOMPLETE'
  readonly message: string
  readonly missing: ReadonlyArray<'checkIn' | 'checkOut' | 'guests'>
}

export const ConversationDomainErrors = {
  LLM_TIMEOUT: () => ({
    code: 'LLM_TIMEOUT' as const,
    message: 'LLM call timed out',
  }),

  LLM_CALL_FAILED: (cause?: string) => ({
    code: 'LLM_CALL_FAILED' as const,
    message: cause ? `LLM call failed: ${cause}` : 'LLM call failed',
  }),

  MESSAGE_LIMIT_EXCEEDED: (count: number, max: number): MessageLimitExceededError => ({
    code: 'MESSAGE_LIMIT_EXCEEDED',
    count,
    max,
    message: `Message limit of ${max} exceeded (${count} messages sent)`,
  }),

  CONFIRM_BOOKING_INCOMPLETE: (
    missing: ReadonlyArray<'checkIn' | 'checkOut' | 'guests'>,
  ): ConfirmBookingIncompleteError => ({
    code: 'CONFIRM_BOOKING_INCOMPLETE',
    missing,
    message: `Confirm booking called with missing fields: ${missing.join(', ')}`,
  }),
} as const