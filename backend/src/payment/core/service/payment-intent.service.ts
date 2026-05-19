import { Injectable, Logger } from '@nestjs/common'
import { ResultAsync, Result, err, ok } from 'neverthrow'
import { ConfigService } from '@/common/config'
import { DomainError } from '@/common/exceptions'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { PaymentIntentEntity } from '@/payment/persist/entities/payment-intent.entity'
import { PaymentIntent, PaymentIntentStatus, StripeStatus } from '@/payment/core/domain'
import { StripeIntegrationClient } from '@/common/integrations/stripe'
import { CreateIntentDto } from '@/payment/http/dto/create-intent.dto'

export type CreatePaymentIntentCommand = CreateIntentDto

export interface CreateIntentResult {
  intentId:     string
  clientSecret: string
}

export interface PaymentStatusResult {
  status:      PaymentIntentStatus
  succeededAt: Date | null
}

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name)

  constructor(
    private readonly stripe:  StripeIntegrationClient,
    private readonly intents: PaymentIntentRepository,
    private readonly config:  ConfigService,
  ) {}

  createIntent(cmd: CreatePaymentIntentCommand): ResultAsync<CreateIntentResult, DomainError> {
    return this.stripe
      .createPaymentIntent({
        amountCents: cmd.amountCents,
        currency:    this.config.get('stripeCurrency'),
        description: cmd.description,
        guestEmail:  cmd.guest.email,
      })
      .map(async stripeIntent => {
        const entity = await this.intents.createFromStripe(
          { ...cmd, currency: this.config.get('stripeCurrency') },
          stripeIntent,
        )
        this.logger.log(`PaymentIntent created: ${entity.externalId}`)
        return {
          intentId:     entity.externalId,
          clientSecret: stripeIntent.clientSecret,
        }
      })
  }

  async getStatus(intentId: string): Promise<Result<PaymentStatusResult, DomainError>> {
    const entity = await this.intents.findOneById(intentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())

    return ok({ status: entity.status, succeededAt: entity.confirmedAt })
  }

  async refreshFromProvider(
    intentId: string,
  ): Promise<Result<{ status: PaymentIntentStatus }, DomainError>> {
    const entity = await this.intents.findOneById(intentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())

    const intent = PaymentIntent.rehydrate(entity)
    if (intent.isTerminal()) return ok({ status: intent.status })

    return this.stripe
      .retrievePaymentIntent(entity.providerIntentId)
      .map(async stripeIntent => {
        const next = StripeStatus.translate(stripeIntent.status)
        if (next !== intent.status) {
          await this.intents.transitionStatus(entity.id, next)
        }
        return { status: next }
      })
  }

  processSucceeded(
    providerIntentId: string,
    payload: object,
  ): Promise<Result<PaymentIntentEntity, DomainError>> {
    return this.applyWebhookTransition(providerIntentId, PaymentIntentStatus.succeeded, payload)
  }

  processFailed(providerIntentId: string, payload: object): Promise<Result<void, DomainError>> {
    return this.applyWebhookTransition(providerIntentId, PaymentIntentStatus.failed, payload)
      .then(r => r.map(() => undefined))
  }

  private async applyWebhookTransition(
    providerIntentId: string,
    target: PaymentIntentStatus,
    payload: object,
  ): Promise<Result<PaymentIntentEntity, DomainError>> {
    const entity = await this.intents.findByProviderIntentId(providerIntentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())
    if (entity.status === target) return ok(entity)

    await this.intents.transitionStatus(entity.id, target, payload)
    return ok(entity)
  }
}