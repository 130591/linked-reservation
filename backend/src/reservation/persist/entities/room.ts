import { DefaultEntity } from "@/common/database"
import { Column, Entity } from "typeorm"

@Entity('rooms')
export class RoomEntity extends DefaultEntity<RoomEntity> {
  @Column()
  name: string

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId: string

  @Column()
  capacity: number
}
