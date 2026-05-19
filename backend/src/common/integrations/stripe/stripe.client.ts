import { Inject, Injectable, Logger } from '@nestjs/common'
import { ResultAsync, err, ok } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { fromStripeError, missingClientSecret } from '@/common/integrations/stripe/stripe-error'
import { STRIPE_CLIENT, StripeClient } from './stripe.provider'
import { StripeCreateIntentInput, StripeIntent, StripeIntentSnapshot } from './contract'

@Injectable()
export class StripeIntegrationClient {
  private readonly logger = new Logger(StripeIntegrationClient.name)

  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: StripeClient) {}

  createPaymentIntent(input: StripeCreateIntentInput): ResultAsync<StripeIntent, DomainError> {
    return this.call('createPaymentIntent', () =>
      this.stripe.paymentIntents.create({
        amount: input.amountCents,
        currency: input.currency,
        description: input.description,
        receipt_email: input.guestEmail,
        automatic_payment_methods: { enabled: true },
      }),
    ).andThen(intent =>
      intent.client_secret
        ? ok({ id: intent.id, status: intent.status, clientSecret: intent.client_secret })
        : err(missingClientSecret(intent.id)),
    )
  }

  retrievePaymentIntent(id: string): ResultAsync<StripeIntentSnapshot, DomainError> {
    return this.call(`retrievePaymentIntent(${id})`, () =>
      this.stripe.paymentIntents.retrieve(id),
    ).map(intent => ({ id: intent.id, status: intent.status }))
  }

  private call<T>(label: string, fn: () => Promise<T>): ResultAsync<T, DomainError> {
    return ResultAsync.fromPromise(fn(), error => {
      this.logger.error(`Stripe: ${label} failed`, error)
      return fromStripeError(error)
    })
  }
}