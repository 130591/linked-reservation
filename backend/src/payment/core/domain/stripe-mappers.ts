import { DomainError } from '@/common/exceptions'
import { PaymentIntentStatus } from './payment-intent-status'

// Stripe PaymentIntent status → local enum
export namespace StripeStatus {
  export function translate(status: string): PaymentIntentStatus {
    switch (status) {
      case 'succeeded':             return PaymentIntentStatus.succeeded
      case 'processing':            return PaymentIntentStatus.processing
      case 'requires_action':       return PaymentIntentStatus.processing
      case 'requires_capture':      return PaymentIntentStatus.processing
      case 'requires_confirmation': return PaymentIntentStatus.pending
      case 'requires_payment_method': return PaymentIntentStatus.pending
      case 'canceled':              return PaymentIntentStatus.cancelled
      default:                      return PaymentIntentStatus.pending
    }
  }
}

// Stripe SDK error → DomainError

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
    }
    return DomainError.PAYMENT_PROVIDER_UNAVAILABLE()
  }
}





