import { IsEmail, IsString, IsUUID, Length, Matches } from 'class-validator'

export class CreatePaymentIntentDto {
  @IsUUID()
  reservationId: string

  @IsString()
  @Length(2, 200)
  guestName: string

  @IsEmail()
  guestEmail: string

  @Matches(/^\+?\d{10,14}$/)
  guestPhone: string
}

export class ConfirmPaymentBodyDto {
  @IsString()
  intentId: string
}
