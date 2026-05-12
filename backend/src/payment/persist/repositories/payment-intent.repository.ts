import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { PaymentIntentEntity } from '../entities/payment-intent.entity'
import { PaymentIntentStatus } from '@/payment/core/domain'

export class PaymentIntentRepository extends DefaultTypeOrmRepository<PaymentIntentEntity> {
  constructor(
    @InjectDataSource('payment')
    dataSource: DataSource,
  ) {
    super(PaymentIntentEntity, dataSource.manager)
  }

  async findByProviderIntentId(providerIntentId: string): Promise<PaymentIntentEntity | null> {
    return this.findOne({ where: { providerIntentId } as any })
  }

  async markSucceeded(id: number, payload: object): Promise<void> {
    await this.update(id, {
      status: PaymentIntentStatus.succeeded,
      confirmedAt: new Date(),
      lastEventPayload: payload,
    })
  }

  protected toDomain(row: any): PaymentIntentEntity {
    return new PaymentIntentEntity(row)
  }
}
