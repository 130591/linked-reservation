import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { ReservationEntity } from '../entities/reservation'

export class ReservationRepository extends DefaultTypeOrmRepository<ReservationEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(ReservationEntity, dataSource.manager)
  }
}