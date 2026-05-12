import { IsEmail, IsInt, IsNotEmpty, IsPositive, IsString, IsUUID } from 'class-validator'

export class CreateIntentDto {
  @IsUUID()
  reservationId: string

  @IsInt()
  @IsPositive()
  amountCents: number

  @IsString()
  @IsNotEmpty()
  description: string

  @IsEmail()
  guestEmail: string
}
