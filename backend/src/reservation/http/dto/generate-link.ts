import { IsDate, IsNumber, IsUUID } from 'class-validator'

export class GenerateLinkCommand {
  @IsUUID()
  hotelId: string

  @IsDate()
  checkIn: Date

  @IsDate()
  checkOut: Date

  @IsNumber()
  guests: number

  @IsUUID()
  staffId: string
}