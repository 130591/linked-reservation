import { DefaultEntity } from "@/common/database"
import { Column, Entity } from "typeorm"

export type StayType = 'HOTEL' | 'POUSADA' | 'HOSTEL' | 'APARTMENT'

@Entity('stays')
export class StayEntity extends DefaultEntity<StayEntity> {
  @Column()
  name: string

  @Column({ unique: true })
  phone: string

  @Column({
    type: 'varchar',
    default: 'HOTEL'
  })
  type: StayType

  @Column({ nullable: true })
  whatsappNumber: string
}
