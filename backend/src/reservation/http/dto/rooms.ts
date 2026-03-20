import { IsDate, IsNumber, IsUUID } from 'class-validator'

export class SelectRoomCommand {
  @IsUUID()
  roomId: string

  @IsUUID()
  sessionId: string
}

export class GetAvailableRoomsCommand {
  @IsUUID()
  hotelId: string

  @IsDate()
  checkIn: Date

  @IsDate()
  checkOut: Date

  @IsNumber()
  guests: number
}