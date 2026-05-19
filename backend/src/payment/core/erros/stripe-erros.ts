import { DomainError } from '@/common/exceptions'

export namespace StripeError {
  export function exception(error: unknown): DomainError {
    if (error instanceof Error && 'type' in error) {
      const stripeError = error as { type: string; decline_code?: string }
      if (stripeError.type === 'card_error')              return DomainError.PAYMENT_DECLINED()
      if (stripeError.type === 'authentication_error')    return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
      if (stripeError.type === 'api_connection_error')    return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
      if (stripeError.type === 'api_error')               return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
      if (stripeError.type === 'invalid_request_error')   return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
      if (stripeError.type === 'rate_limit_error')        return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
      if (stripeError.type === '')                 return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
    }
    return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
  }

  export const from = exception
}





