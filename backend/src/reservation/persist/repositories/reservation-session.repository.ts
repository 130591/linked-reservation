import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { ReservationSessionEntity } from '../entities/reservation-session'

export class ReservationSessionRepository extends DefaultTypeOrmRepository<ReservationSessionEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(ReservationSessionEntity, dataSource.manager)
  }
}
