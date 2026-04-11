import { DefaultEntity } from '@/common/database'
import { Reservation } from '@/reservation/core/domain'
import { Column, Entity, Exclusion } from 'typeorm'

export type ReservationEntityStatus = 'HOLD' | 'CONFIRMED' | 'EXPIRED'

@Entity({ name: 'reservations', schema: 'reservation' })
@Exclusion(
  `USING gist (room_id WITH =, tstzrange(check_in, check_out, '[]') WITH &&) WHERE ("status" IN ('HOLD', 'CONFIRMED') AND "deleted_at" IS NULL)`,
)
export class ReservationEntity extends DefaultEntity<ReservationEntity> {

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string

  @Column({ name: 'check_in', type: 'timestamptz' })
  checkIn: Date

  @Column({ name: 'check_out', type: 'timestamptz' })
  checkOut: Date

  @Column({ type: 'text', default: 'HOLD' })
  status: ReservationEntityStatus

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null

  static fromDomain(reservation: Reservation): ReservationEntity {
    return new ReservationEntity({
      roomId: reservation.getRooms()[0].getId(),
      checkIn: reservation.getPeriod().getStartDate(),
      checkOut: reservation.getPeriod().getEndDate(),
      status: 'HOLD',
      deletedAt: null
    })
  }
}