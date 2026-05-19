import { ConfigService } from '@/common/config'
import { DomainError } from '@/common/exceptions'
import { PaymentAPI } from '@/payment/external-api'
import { CreatePaymentIntentDto } from '@/reservation/http/dto'
import { ReservationRepository, RoomRepository } from '@/reservation/persist'
import { Injectable } from '@nestjs/common'

interface InitiateBookingPaymentCommand extends CreatePaymentIntentDto {
  stayName: string
}


@Injectable()
export class InitiateBookingPayment {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly roomRepo: RoomRepository,
    private readonly paymentAPI: PaymentAPI,
    private readonly configService: ConfigService,
  ) {}

  async handle(command: InitiateBookingPaymentCommand) {
    const reservation = await this.reservationRepo.findOneById(command.reservationId)
      if (!reservation) throw DomainError.RESERVATION_NOT_FOUND()
  
      const room = await this.roomRepo.findOneByPk(reservation.roomId)
      if (!room) throw DomainError.ROOM_NOT_FOUND()
  
      const nights = Math.max(
        1,
        Math.round(
          (reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86_400_000
        )
      )
      const amountCents = room.pricePerNight * nights
  
      const result = await this.paymentAPI.createIntent({
        reservationId: command.reservationId,
        amountCents,
        description:   `Reserva ${command.stayName}`,
        guest: {
          name:  command.guestName,
          email: command.guestEmail,
          phone: command.guestPhone,
        },
      })
      if (result.isErr()) throw result.error
  
      return {
        ...result.value,
        publishableKey: this.configService.get('stripePublishableKey'),
      }
  }
}