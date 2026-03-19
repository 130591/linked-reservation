import { DefaultEntity } from "@/common/database"
import { Column, Entity } from "typeorm"

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED'

@Entity('reservation_sessions')
export class ReservationSessionEntity extends DefaultEntity<ReservationSessionEntity> {
  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string

  @Column({ name: 'check_in', type: 'date' })
  checkIn: Date

  @Column({ name: 'check_out', type: 'date' })
  checkOut: Date

  @Column()
  guests: number

  @Column({ name: 'staff_id', type: 'uuid' })
  staffId: string

  @Column({
    type: 'text',
    default: "'ACTIVE'",
  })
  status: SessionStatus

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date

  @Column({ type: 'jsonb', nullable: true })
  customer: {
    name?: string
    phone?: string
  } | null

  @Column({ default: 1 })
  version: number

  isExpired(): boolean {
    return this.status === 'EXPIRED' || new Date() > this.expiresAt
  }
}