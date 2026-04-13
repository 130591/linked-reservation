import { DefaultEntity } from '@/common/database/entities'
import { Column, Entity } from 'typeorm'

@Entity({ name: 'outbox_events', schema: 'common' })
export class OutboxEventEntity extends DefaultEntity<OutboxEventEntity> {
  @Column({ type: 'varchar' })
  queue: string

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @Column({ name: 'delay_seconds', type: 'int', default: 0 })
  delaySeconds: number

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null
}