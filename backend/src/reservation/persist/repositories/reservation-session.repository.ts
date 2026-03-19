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

  protected toDomain(row: any): ReservationSessionEntity {
    return new ReservationSessionEntity({
      id: row.id,
      hotelId: row.hotelId,
      staffId: row.staffId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      guests: row.guests,
      status: row.status,
      expiresAt: row.expiresAt,
      customer: row.customer,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}
