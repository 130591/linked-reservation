import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class GuestDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEmail()
  email: string

  @IsString()
  @IsNotEmpty()
  phone: string
}

export class CreateIntentDto {
  @IsUUID()
  reservationId: string

  @IsInt()
  @IsPositive()
  amountCents: number

  @IsString()
  @IsOptional()
  description?: string

  @ValidateNested()
  @Type(() => GuestDto)
  guest: GuestDto
}
