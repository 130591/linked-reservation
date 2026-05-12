import { Column, Entity } from 'typeorm'
import { DefaultEntity } from '@/common/database/entities'

@Entity({ name: 'webhook_events', schema: 'payment' })
export class WebhookEventEntity extends DefaultEntity<WebhookEventEntity> {
  @Column({ name: 'event_id', type: 'varchar', unique: true })
  eventId: string

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string

  @Column({ type: 'jsonb' })
  payload: object

  @Column({ name: 'processed_at', type: 'timestamptz', default: () => 'now()' })
  processedAt: Date
}
