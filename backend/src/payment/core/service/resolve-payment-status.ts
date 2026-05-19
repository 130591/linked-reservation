import { Injectable } from '@nestjs/common'
import { DomainError } from '@/common/exceptions'
import { PaymentIntentStatus } from '@/payment/core/domain'
import { PaymentIntentRepository } from '@/payment/persist'
import { PaymentIntentService } from './payment-intent.service'

const STALE_THRESHOLD_MS = 90_000

@Injectable()
export class ResolvePaymentStatus {
  constructor(
    private readonly intents: PaymentIntentRepository,
    private readonly intentService: PaymentIntentService,
  ) {}

  async handle(intentId: string) {
    const intent = await this.intents.findOneById(intentId)
    if (!intent) throw DomainError.PAYMENT_INTENT_NOT_FOUND()

    const ageMs = Date.now() - intent.createdAt.getTime()
    if (intent.status === PaymentIntentStatus.pending && ageMs > STALE_THRESHOLD_MS) {
      const refreshResult = await this.intentService.refreshFromProvider(intentId)
      if (refreshResult.isErr()) throw refreshResult.error

      const newStatus = refreshResult.value.status
      return {
        status: newStatus,
        succeededAt: newStatus === PaymentIntentStatus.succeeded ? new Date() : null,
      }
    }

    return { status: intent.status, succeededAt: intent.confirmedAt }
  }
}
