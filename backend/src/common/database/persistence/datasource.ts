import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as dotenv from 'dotenv'

dotenv.config()

// Entities
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

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
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
  migrations: ['src/common/database/migrations/*.ts'],
  migrationsTableName: 'migrations',  // goes to public schema — exists before our schemas are created
})
