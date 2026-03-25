import { IsDate, IsNumber, IsString, IsUUID } from 'class-validator'

export class GenerateLinkCommand {
  @IsUUID()
  hotelId: string

  @IsString()
  hotelName: string

  @IsString()
  customerName: string

  @IsDate()
  checkIn: Date

  @IsDate()
  checkOut: Date

  @IsNumber()
  guests: number

  @IsUUID()
  staffId: string
}