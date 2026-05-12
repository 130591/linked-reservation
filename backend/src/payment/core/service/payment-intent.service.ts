import { Injectable, Logger, Inject } from '@nestjs/common'
import { ok, err, Result } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { STRIPE_CLIENT, StripeClient } from '@/common/integrations/stripe'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { PaymentIntentEntity } from '@/payment/persist/entities/payment-intent.entity'
import { PaymentIntent, PaymentIntentStatus, StripeStatus, StripeError } from '@/payment/core/domain'
import { CreateIntentDto } from '@/payment/http/dto/create-intent.dto'

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
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly intentRepo: PaymentIntentRepository,
  ) {}

  async createIntent(
    input: CreateIntentDto,
  ): Promise<Result<CreateIntentResult, DomainError>> {
    let stripeIntent: Awaited<ReturnType<typeof this.stripe.paymentIntents.create>>

    try {
      stripeIntent = await this.stripe.paymentIntents.create({
        amount:        input.amountCents,
        currency:      'brl',
        description:   input.description,
        receipt_email: input.guestEmail,
        automatic_payment_methods: { enabled: true },
      })
    } catch (error) {
      this.logger.warn('Stripe createIntent failed', error)
      return err(StripeError.exception(error))
    }

    const entity = await this.intentRepo.save(
      new PaymentIntentEntity({
        reservationId:    input.reservationId,
        providerIntentId: stripeIntent.id,
        amountCents:      input.amountCents,
        currency:         'BRL',
        status:           StripeStatus.translate(stripeIntent.status),
        lastEventPayload: null,
        confirmedAt:      null,
      }),
    )

    this.logger.log(`PaymentIntent created: ${entity.externalId}`)
    return ok({
      intentId:     entity.externalId,
      clientSecret: stripeIntent.client_secret!,
    })
  }

  async getStatus(
    intentId: string,
  ): Promise<Result<PaymentStatusResult, DomainError>> {
    const entity = await this.intentRepo.findOneById(intentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())

    return ok({
      status:      entity.status,
      succeededAt: entity.confirmedAt,
    })
  }

  async refreshFromProvider(
    intentId: string,
  ): Promise<Result<{ status: PaymentIntentStatus }, DomainError>> {
    const entity = await this.intentRepo.findOneById(intentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())

    const domainResult = PaymentIntent.create(
      entity.externalId,
      entity.reservationId,
      entity.providerIntentId,
      entity.amountCents,
      entity.currency,
      entity.status,
      entity.confirmedAt,
    )
    if (domainResult.isErr()) return err(domainResult.error)
    const domain = domainResult.value

    if (domain.isTerminal()) {
      return ok({ status: domain.status })
    }

    let stripeIntent: Awaited<ReturnType<typeof this.stripe.paymentIntents.retrieve>>
    try {
      stripeIntent = await this.stripe.paymentIntents.retrieve(entity.providerIntentId)
    } catch (error) {
      this.logger.warn(`Stripe retrieve failed for ${intentId}`, error)
      return err(StripeError.exception(error))
    }

    const newStatus = StripeStatus.translate(stripeIntent.status)
    if (newStatus !== entity.status) {
      const update: Partial<PaymentIntentEntity> = { status: newStatus }
      if (newStatus === PaymentIntentStatus.succeeded) {
        update.confirmedAt = new Date()
      }
      await this.intentRepo.update(entity.id, update)
      this.logger.log(`PaymentIntent ${intentId} refreshed: ${entity.status} → ${newStatus}`)
    }

    return ok({ status: newStatus })
  }

  async processSucceeded(
    providerIntentId: string,
    eventPayload:     object,
  ): Promise<Result<void, DomainError>> {
    const entity = await this.intentRepo.findByProviderIntentId(providerIntentId)
    if (!entity) return err(DomainError.PAYMENT_INTENT_NOT_FOUND())

    if (entity.status === PaymentIntentStatus.succeeded) {
      return ok(undefined)
    }

    await this.intentRepo.markSucceeded(entity.id, eventPayload)
    this.logger.log(`PaymentIntent ${entity.externalId} marked succeeded via event`)
    return ok(undefined)
  }
}
