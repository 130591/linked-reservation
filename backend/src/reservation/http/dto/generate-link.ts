import { IsDate, IsNumber, IsString, IsUUID } from 'class-validator'

export class GenerateLinkCommand {
  @IsUUID()
  stayId: string

  @IsString()
  stayName: string

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