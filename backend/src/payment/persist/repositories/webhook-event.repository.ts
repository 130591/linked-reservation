import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { WebhookEventEntity } from '../entities/webhook-event.entity'

export class WebhookEventRepository extends DefaultTypeOrmRepository<WebhookEventEntity> {
  constructor(
    @InjectDataSource('payment')
    dataSource: DataSource,
  ) {
    super(WebhookEventEntity, dataSource.manager)
  }

  async findByEventId(eventId: string): Promise<WebhookEventEntity | null> {
    return this.findOne({ where: { eventId } as any })
  }

  protected toDomain(row: any): WebhookEventEntity {
    return new WebhookEventEntity(row)
  }
}
