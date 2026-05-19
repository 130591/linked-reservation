export type StripePaymentIntentStatus =
  | 'canceled'
  | 'processing'
  | 'requires_action'
  | 'requires_capture'
  | 'requires_confirmation'
  | 'requires_payment_method'
  | 'succeeded'

export interface StripeCreateIntentInput {
  amountCents: number
  currency:    string
  description?: string
  guestEmail?:  string
}

export interface StripeIntent {
  id:           string
  status:       StripePaymentIntentStatus
  clientSecret: string
}

export interface StripeIntentSnapshot {
  id:     string
  status: StripePaymentIntentStatus
}