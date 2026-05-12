import { Provider } from '@nestjs/common'
import Stripe = require('stripe')
import { ConfigService } from '@/common/config'

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT')

export type StripeClient = Stripe.Stripe

export const StripeProvider: Provider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): StripeClient =>
    new Stripe(config.get('stripeSecretKey'), { apiVersion: '2026-04-22.dahlia' }),
}
