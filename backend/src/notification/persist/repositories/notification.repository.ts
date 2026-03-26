import { DefaultTypeOrmRepository } from '@/common/database'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotificationEntity } from '../entities/notification'

@Injectable()
export class NotificationRepository extends DefaultTypeOrmRepository<NotificationEntity> {
  constructor(
    @InjectDataSource()
    dataSource: DataSource
  ) {
    super(NotificationEntity, dataSource.manager)
  }

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
      stayId: row.stayId,
      sentAt: row.sentAt,
      failedAt: row.failedAt,
      error: row.error,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}
