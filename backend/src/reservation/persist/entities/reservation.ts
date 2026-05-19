import { DefaultEntity } from '@/common/database/entities'
import { Column, Entity, Exclusion } from 'typeorm'

export type ReservationEntityStatus = 'HOLD' | 'CONFIRMED' | 'EXPIRED'

@Entity({ name: 'reservations', schema: 'reservation' })
@Exclusion(
  `USING gist (room_id WITH =, tstzrange(check_in, check_out, '[]') WITH &&) WHERE ("status" IN ('HOLD', 'CONFIRMED') AND "deleted_at" IS NULL)`,
)
export class ReservationEntity extends DefaultEntity<ReservationEntity> {

  @Column({ name: 'room_id', type: 'bigint' })
  roomId: number

  @Column({ name: 'session_id', type: 'bigint' })
  sessionId: number

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

  @Column({ name: 'booking_reference', type: 'varchar', length: 32, nullable: true })
  bookingReference: string | null

  @Column({ name: 'payment_intent_id', type: 'uuid', nullable: true })
  paymentIntentId: string | null

  @Column({ name: 'guest_name', type: 'varchar', length: 200, nullable: true })
  guestName: string | null

  @Column({ name: 'guest_email', type: 'varchar', length: 320, nullable: true })
  guestEmail: string | null

  @Column({ name: 'guest_phone', type: 'varchar', length: 32, nullable: true })
  guestPhone: string | null

}