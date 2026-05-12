import { Injectable, Logger } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import {
  EventQueues,
  PaymentIntentSucceededPayload,
  PaymentIntentFailedPayload,
} from '@/common/events'
import { PaymentIntentService } from '../core/service/payment-intent.service'

@Injectable()
export class PaymentEventsConsumer {
  private readonly logger = new Logger(PaymentEventsConsumer.name)

  constructor(private readonly intentService: PaymentIntentService) {}

  @SqsMessageHandler(EventQueues.PAYMENT_INTENT_SUCCEEDED)
  async handlePaymentIntentSucceeded(message: Message): Promise<void> {
    const payload = JSON.parse(message.Body!) as PaymentIntentSucceededPayload

    const result = await this.intentService.processSucceeded(
      payload.providerIntentId,
      payload.eventPayload,
    )

    if (result.isErr()) {
      this.logger.warn(`Failed to process succeeded event for ${payload.providerIntentId}`, result.error)
    }
  }

  @SqsMessageHandler(EventQueues.PAYMENT_INTENT_FAILED)
  async handlePaymentIntentFailed(message: Message): Promise<void> {
    const payload = JSON.parse(message.Body!) as PaymentIntentFailedPayload

    this.logger.warn(`PaymentIntent failed: ${payload.providerIntentId}`)
  }
}
