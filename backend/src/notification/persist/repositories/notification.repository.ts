import { DefaultTypeOrmRepository } from '@/common/database'
import { NotificationEntity } from '../entities/notification'


export class NotificationRepository extends DefaultTypeOrmRepository<NotificationEntity> {
  protected toDomain(row: any): NotificationEntity {
    return new NotificationEntity({
      id: row.id,
      recipientId: row.recipientId,
      recipientType: row.recipientType,
      channel: row.channel,
      destination: row.destination,
      eventType: row.eventType,
      templateId: row.templateId,
      payload: row.payload,
      renderedBody: row.renderedBody,
      status: row.status,
      hotelId: row.hotelId,
      sentAt: row.sentAt,
      failedAt: row.failedAt,
      error: row.error,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}
