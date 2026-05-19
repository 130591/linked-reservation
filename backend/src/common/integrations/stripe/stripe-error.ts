import { DomainError } from '@/common/exceptions'

export function fromStripeError(error: unknown): DomainError {
  return isCardError(error)
    ? DomainError.PAYMENT_DECLINED()
    : DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
}

export function missingClientSecret(intentId: string): DomainError {
  return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
}

function isCardError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'type' in error &&
    (error as { type: string }).type === 'card_error'
  )
}