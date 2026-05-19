import { Logger } from '@nestjs/common'
import { StripePaymentIntentStatus } from '@/common/integrations/stripe/contract'

const logger = new Logger('StripeStatus')

export enum PaymentIntentStatus {
  pending    = 'pending',
  processing = 'processing',
  succeeded  = 'succeeded',
  failed     = 'failed',
  cancelled  = 'cancelled',
}


export namespace StripeStatus {
  export function translate(status: StripePaymentIntentStatus): PaymentIntentStatus {
    switch (status) {
      case 'succeeded':
        return PaymentIntentStatus.succeeded
      case 'processing':
      case 'requires_action':
      case 'requires_capture':
        return PaymentIntentStatus.processing
      case 'requires_confirmation':
      case 'requires_payment_method':
        return PaymentIntentStatus.pending
      case 'canceled':
        return PaymentIntentStatus.cancelled
      default:
        logger.warn(`Unknown Stripe status "${status}", defaulting to pending`)
        return PaymentIntentStatus.pending
    }
  }
}
