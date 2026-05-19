import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { PaymentIntentEntity } from '../entities/payment-intent.entity'
import { PaymentIntentStatus, StripeStatus } from '@/payment/core/domain'
import { StripeIntent } from '@/common/integrations/stripe/contract'


export interface CreateIntentPersistInput {
  reservationId: string
  amountCents:   number
  currency:      string
  guest: {
    name:  string
    email: string
    phone: string
  }
}

@Injectable()
export class PaymentIntentRepository extends DefaultTypeOrmRepository<PaymentIntentEntity> {
  constructor(
    @InjectDataSource('payment')
    dataSource: DataSource,
  ) {
    super(PaymentIntentEntity, dataSource.manager)
  }

  findByProviderIntentId(providerIntentId: string): Promise<PaymentIntentEntity | null> {
    return this.findOne({ where: { providerIntentId } })
  }

  createFromStripe(input: CreateIntentPersistInput, stripeIntent: StripeIntent,): Promise<PaymentIntentEntity> {
    return this.save(
      new PaymentIntentEntity({
        reservationId:    input.reservationId,
        providerIntentId: stripeIntent.id,
        amountCents:      input.amountCents,
        currency:         input.currency,
        status:           StripeStatus.translate(stripeIntent.status),
        customer:         input.guest,
        confirmedAt:      null,
      }),
    )
  }

  async transitionStatus(
    id:number,
    status:PaymentIntentStatus,
    eventPayload?: object,
  ): Promise<void> {
    const patch: QueryDeepPartialEntity<PaymentIntentEntity> = { status }

    if (status === PaymentIntentStatus.succeeded) {
      patch.confirmedAt = () => 'CURRENT_TIMESTAMP'
    }
    if (eventPayload) {
      patch.lastEventPayload = eventPayload
    }

    await this.update(id, patch)
  }

  protected toDomain(row: any): PaymentIntentEntity {
    return new PaymentIntentEntity({
      id: row.id,
      reservationId: row.reservationId,
      providerIntentId: row.providerIntentId,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status,
      customer: row.customer,
      lastEventPayload: row.lastEventPayload,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}