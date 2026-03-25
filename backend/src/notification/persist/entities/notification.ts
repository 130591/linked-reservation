import { DefaultEntity } from '@/common/database'
import { Column, Entity } from 'typeorm'

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED'
export type NotificationChannel = 'WHATSAPP' | 'EMAIL'
export type RecipientType = 'STAFF' | 'CUSTOMER'

@Entity('notifications')
export class NotificationEntity extends DefaultEntity<NotificationEntity> {

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string

  @Column({ name: 'recipient_type', type: 'varchar' })
  recipientType: RecipientType

  @Column({ type: 'varchar' })
  channel: NotificationChannel

  @Column({ type: 'varchar' })
  destination: string

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string                // 'reservation.confirmed' etc

  @Column({ name: 'template_id', type: 'varchar' })
  templateId: string               // 'reservation.confirmed/whatsapp'

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown> // raw data used in rendering

  @Column({ name: 'rendered_body', type: 'text' })
  renderedBody: string

  @Column({ type: 'varchar', default: 'PENDING' })
  status: NotificationStatus

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null

  @Column({ name: 'failed_at', type: 'timestamp', nullable: true })
  failedAt: Date | null

  @Column({ type: 'text', nullable: true })
  error: string | null             // error message to the external API if failed
}