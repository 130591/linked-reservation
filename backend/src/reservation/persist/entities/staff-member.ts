import { DefaultEntity } from "@/common/database"
import { Column, Entity } from "typeorm"

export type StaffRole = 'ATTENDANT' | 'MANAGER' | 'OWNER'

@Entity({ name: 'staff_members', schema: 'reservation' })
export class StaffMemberEntity extends DefaultEntity<StaffMemberEntity> {
  @Column({ name: 'stay_id', type: 'uuid' })
  stayId: string

  @Column()
  name: string

  @Column({ unique: true, nullable: true })
  email: string

  @Column({ nullable: true })
  phone: string

  @Column({
    type: 'varchar',
    default: 'ATTENDANT'
  })
  role: StaffRole

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean

  @Column({ name: 'max_concurrent_sessions', default: 5 })
  maxConcurrentSessions: number

  @Column({ name: 'current_sessions', default: 0 })
  currentSessions: number
}
