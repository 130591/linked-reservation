import { DefaultTypeOrmRepository } from '@/common/database'
import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { RoutingRuleEntity } from '../entities/routing-rule'

@Injectable()
export class RoutingRuleRepository extends DefaultTypeOrmRepository<RoutingRuleEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(RoutingRuleEntity, dataSource.manager)
  }

  async findActiveRules(
    stayId: string,
    eventType: string,
    recipientType: string
  ): Promise<RoutingRuleEntity[]> {
    return await this.find({
      where: [
        { stayId, eventType, recipientType, active: true },
        { stayId, eventType, recipientType: 'ALL', active: true }
      ]
    })
  }

  protected toDomain(row: any): RoutingRuleEntity {
    return new RoutingRuleEntity({
      id: row.id,
      stayId: row.stayId,
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