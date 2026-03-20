import { IsDate, IsUUID } from 'class-validator'

export class ConfirmReservationCommand {
  @IsUUID()
  sessionId: string

  @IsDate()
  checkIn: Date

  @IsDate()
  checkOut: Date

  @IsUUID()
  roomId: string
}