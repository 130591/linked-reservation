import { DataSource, In, IsNull } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { ReservationEntity } from '../entities/reservation'
import { sql } from '../sql'

export class ReservationRepository extends DefaultTypeOrmRepository<ReservationEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(ReservationEntity, dataSource.manager)
  }

  async findActiveReservations(checkIn: Date, checkOut: Date) {
    return await this.manager.query(sql, [
      checkIn,
      checkOut
    ]).then(rows => rows.map(row => this.toDomain(row)))
  }

  async findActiveHoldBySession(sessionId: number): Promise<ReservationEntity | null> {
    return this.findOne({
      where: {
        sessionId,
        status: 'HOLD',
        deletedAt: IsNull()
      } as any
    })
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<ReservationEntity | null> {
    return this.findOne({ where: { paymentIntentId } as any })
  }

  async cancelHold(reservationId: string): Promise<void> {
    await this.update(reservationId, {
      status: 'CANCELLED',
      deletedAt: () => 'CURRENT_TIMESTAMP'
    })
  }

  protected toDomain(row: any) {
    return new ReservationEntity({
      id: row.id,
      roomId: row.roomId,
      sessionId: row.sessionId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      expiresAt: row.expiresAt,
      deletedAt: row.deletedAt
    })
  }
}