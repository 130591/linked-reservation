import { Injectable } from '@nestjs/common'
import { Result } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { PaymentIntentStatus } from '@/payment/core/domain'
import {
  PaymentIntentService,
  CreateIntentResult,
  PaymentStatusResult,
} from '@/payment/core/service/payment-intent.service'
import { CreateIntentDto } from '@/payment/http/dto/create-intent.dto'

export { CreateIntentDto, CreateIntentResult, PaymentStatusResult }

@Injectable()
export class PaymentAPI {
  constructor(private readonly intentService: PaymentIntentService) {}

  createIntent(
    input: CreateIntentDto,
  ): Promise<Result<CreateIntentResult, DomainError>> {
    return this.intentService.createIntent(input)
  }

  getStatus(
    intentId: string,
  ): Promise<Result<PaymentStatusResult, DomainError>> {
    return this.intentService.getStatus(intentId)
  }

  refreshFromProvider(
    intentId: string,
  ): Promise<Result<{ status: PaymentIntentStatus }, DomainError>> {
    return this.intentService.refreshFromProvider(intentId)
  }
}
