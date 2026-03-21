import { DefaultTypeOrmRepository } from '@/common/database'
import { Injectable } from '@nestjs/common'
import { RoutingRuleEntity } from '../entities/routing-rule'

@Injectable()
export class RoutingRuleRepository extends DefaultTypeOrmRepository<RoutingRuleEntity> {
  async findActiveRules(
    hotelId: string,
    eventType: string,
    recipientType: string
  ): Promise<RoutingRuleEntity[]> {
    return await this.find({
      where: [
        { hotelId, eventType, recipientType, active: true },
        { hotelId, eventType, recipientType: 'ALL', active: true }
      ]
    })
  }

  protected toDomain(row: any): RoutingRuleEntity {
    return new RoutingRuleEntity({
      id: row.id,
      hotelId: row.hotelId,
      eventType: row.eventType,
      channel: row.channel,
      recipientType: row.recipientType,
      active: row.active,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}