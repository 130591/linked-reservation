
import { DefaultEntity } from '@/common/database/entities'
import { Column, Entity } from 'typeorm'

@Entity({ name: 'routing_rules', schema: 'notification' })
export class RoutingRuleEntity extends DefaultEntity<RoutingRuleEntity> {
  @Column()
  stayId: string

  @Column()
  eventType: string

  @Column()
  channel: string

  @Column()
  recipientType: string

  @Column()
  active: boolean

  @Column()
  quietHoursStart: string

  @Column()
  quietHoursEnd: string
}