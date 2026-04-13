import { DefaultEntity } from "@/common/database/entities"
import { Column, Entity } from "typeorm"

@Entity({ name: 'rooms', schema: 'reservation' })
export class RoomEntity extends DefaultEntity<RoomEntity> {
  @Column()
  name: string

  @Column({ name: 'stay_id', type: 'uuid' })
  stayId: string

  @Column()
  capacity: number
}
