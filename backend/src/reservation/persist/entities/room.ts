import { DefaultEntity } from "@/common/database"
import { Column, Entity } from "typeorm"

@Entity('rooms')
export class RoomEntity extends DefaultEntity<RoomEntity> {
  @Column()
  name: string

  @Column({ name: 'stay_id', type: 'uuid' })
  stayId: string

  @Column()
  capacity: number
}
