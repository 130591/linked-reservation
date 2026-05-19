import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
} from '@nestjs/common'
import { RawBodyRequest } from '@nestjs/common'
import { Request } from 'express'
import { ConfigService } from '@/common/config'
import { STRIPE_CLIENT, StripeClient } from '@/common/integrations/stripe'
import { PaymentIntentService } from '@/payment/core/service/payment-intent.service'
import { WebhookEventRepository } from '@/payment/persist/repositories/webhook-event.repository'
import { WebhookEventEntity } from '@/payment/persist/entities/webhook-event.entity'
import { ConfirmPayment } from '@/reservation/core/service/confirm-payment'

@Controller('payment')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name)

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: StripeClient,
    private readonly intentService: PaymentIntentService,
    private readonly webhookEventRepo: WebhookEventRepository,
    private readonly confirmPayment: ConfirmPayment,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    const rawBody      = req.rawBody
    const webhookSecret = this.configService.get('stripeWebhookSecret')

    let event: ReturnType<StripeClient['webhooks']['constructEvent']>
    try {
      event = this.stripe.webhooks.constructEvent(rawBody!, signature, webhookSecret)
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    try {
      await this.webhookEventRepo.save(
        new WebhookEventEntity({
          eventId:   event.id,
          eventType: event.type,
          payload:   event as unknown as object,
        }),
      )
    } catch (err: any) {
      if (err?.code === '23505' || err?.driverError?.code === '23505') {
        this.logger.log(`Webhook duplicate skipped: ${event.id}`)
        return
      }
      throw err
    }

    if (event.type === 'payment_intent.succeeded') {
      const stripeIntentId = (event.data.object as { id: string }).id
      await this.handleSucceeded(stripeIntentId, event as unknown as object)
    } else if (event.type === 'payment_intent.payment_failed') {
      const stripeIntentId = (event.data.object as { id: string }).id
      await this.handleFailed(stripeIntentId, event as unknown as object)
    } else {
      this.logger.log(`Stripe event ${event.type} persisted; no action`)
    }
  }

  private async handleSucceeded(stripeIntentId: string, eventPayload: object): Promise<void> {
    const result = await this.intentService.processSucceeded(stripeIntentId, eventPayload)
    if (result.isErr()) {
      this.logger.error(`processSucceeded failed for ${stripeIntentId}: ${result.error.code}`)
      return
    }

    const entity = result.value

    const confirmResult = await this.confirmPayment.handle({
      paymentIntentId: entity.externalId,
      guestName:       entity.customer?.name  ?? '',
      guestEmail:      entity.customer?.email ?? '',
      guestPhone:      entity.customer?.phone ?? '',
    })

    if (confirmResult.isErr()) {
      this.logger.error(
        `ConfirmPayment failed for intent ${entity.externalId}: ${confirmResult.error.code}`,
      )
    }
  }

  private async handleFailed(stripeIntentId: string, eventPayload: object): Promise<void> {
    const result = await this.intentService.processFailed(stripeIntentId, eventPayload)
    if (result.isErr()) {
      this.logger.error(`processFailed for ${stripeIntentId}: ${result.error.code}`)
    }
  }
}
