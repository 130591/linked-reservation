import { IsDate, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator'

export class GenerateLinkCommand {
  @IsUUID()
  stayId: string

  @IsString()
  stayName: string

  @IsOptional()
  @IsString()
  customerName?: string

  @IsDate()
  checkIn: Date

  @IsDate()
  checkOut: Date

  @IsNumber()
  guests: number

  @IsUUID()
  staffId: string
}