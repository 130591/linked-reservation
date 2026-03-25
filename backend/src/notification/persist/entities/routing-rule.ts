
import { DefaultEntity } from '@/common/database'
import { Column, Entity } from 'typeorm'

@Entity('routing_rule')
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