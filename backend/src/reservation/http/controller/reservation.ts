import { Controller, Get, Header, UseGuards } from '@nestjs/common'
import { ReservationViewTokenGuard } from '@/common/framework/guards/reservation-view-token.guard'
import { Reservation } from '@/common/framework/decorators/reservation.decorator'
import { ReservationEntity } from '@/reservation/persist/entities/reservation'
import { RoomRepository, ReservationSessionRepository, StayRepository } from '@/reservation/persist'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { toConfirmationView } from '../dto'

@Controller('booking')
export class ReservationController {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly stayRepo: StayRepository,
    private readonly paymentIntentRepo: PaymentIntentRepository,
  ) { }

  @Header('Referrer-Policy', 'no-referrer')
  @UseGuards(ReservationViewTokenGuard)
  @Get('confirmation')
  async getConfirmation(@Reservation() reservation: ReservationEntity) {
    const [room, session] = await Promise.all([
      this.roomRepo.findOneByPk(reservation.roomId),
      this.sessionRepo.findOneByPk(reservation.sessionId),
    ])
    const stay = await this.stayRepo.findOneById(session!.stayId)
    const paymentIntent = await this.paymentIntentRepo.findOneById(reservation.paymentIntentId!)

    return toConfirmationView(reservation, room!, stay!, paymentIntent!, session!)
  }
}
