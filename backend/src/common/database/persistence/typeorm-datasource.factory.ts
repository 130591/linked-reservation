import { ConfigService } from '@/common/config/service/config.service'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { PropertyEntity } from '@/identity/persist/entities/property'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'
import { StayEntity } from '@/reservation/persist/entities/stay'
import { RoomEntity } from '@/reservation/persist/entities/room'
import { StaffMemberEntity } from '@/reservation/persist/entities/staff-member'
import { ReservationEntity } from '@/reservation/persist/entities/reservation'
import { ReservationSessionEntity } from '@/reservation/persist/entities/reservation-session'
import { NotificationEntity } from '@/notification/persist/entities/notification'
import { RoutingRuleEntity } from '@/notification/persist/entities/routing-rule'
import { OutboxEventEntity } from '@/common/messaging/outbox/outbox-event.entity'

export const dataSourceOptionsFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('database.host'),
  port: configService.get('database.port'),
  username: configService.get('database.username'),
  password: configService.get('database.password'),
  database: configService.get('database.database'),
  synchronize: false,
  logging: false,
  entities: [
    PropertyEntity,
    IdentityStaffMemberEntity,
    StayEntity,
    RoomEntity,
    StaffMemberEntity,
    ReservationEntity,
    ReservationSessionEntity,
    NotificationEntity,
    RoutingRuleEntity,
    OutboxEventEntity,
  ],
})
