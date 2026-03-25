import { DataSource } from 'typeorm'
import { dataSourceOptionsFactory, TypeOrmPersistenceModule } from "@/common/database/persistence";
import { Module } from '@nestjs/common'
import { addTransactionalDataSource } from 'typeorm-transactional'
import { ConfigService } from '@/common/config/service/config.service'
import { ReservationRepository } from './repositories/reservation.repository'
import { ReservationSessionRepository } from './repositories/reservation-session.repository'
import { RoomRepository } from './repositories/room.repository'
import { StayRepository } from './repositories/stay.repository'


const repositories = [ReservationRepository, ReservationSessionRepository, RoomRepository, StayRepository]

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
        return addTransactionalDataSource({
          name: options.name,
          dataSource: new DataSource(options),
        })
      },
    }),
  ],
  providers: [...repositories],
  exports: [...repositories],
})
export class ReservationPersistenceModule { }