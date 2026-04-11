import { DataSource } from 'typeorm'
import { dataSourceOptionsFactory, TypeOrmPersistenceModule } from "@/common/database/persistence";
import { Module } from '@nestjs/common'
import { addTransactionalDataSource } from 'typeorm-transactional'
import { ConfigService } from '@/common/config/service/config.service'
import { ReservationRepository } from './repositories/reservation.repository'
import { ReservationSessionRepository } from './repositories/reservation-session.repository'
import { RoomRepository } from './repositories/room.repository'
import { StayRepository } from './repositories/stay.repository'
import { StaffMemberRepository } from './repositories/staff-member.repository'


const repositories = [
  ReservationRepository, 
  ReservationSessionRepository, 
  RoomRepository, 
  StayRepository,
  StaffMemberRepository
]

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      name: 'reservation',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return dataSourceOptionsFactory(configService)
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid options passed')
        }
        const dataSource = new DataSource(options)
        // Register as 'default' so @Transactional() without a name works
        addTransactionalDataSource({ name: 'default', dataSource })
        return addTransactionalDataSource({ name: options.name, dataSource })
      },
    }),
  ],
  providers: [...repositories],
  exports: [...repositories],
})
export class ReservationPersistenceModule { }