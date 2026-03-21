import { ReservationRepository, ReservationSessionRepository } from '@/reservation/persist'
import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common'
import { Transactional } from 'typeorm-transactional'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { EventQueues, ReservationConfirmedPayload } from '@/common/events'
import { ConfigService } from '@/common/config'

interface ConfirmPaymentCommand {
  reservationId: string
  paymentId: string
}

@Injectable()
export class ConfirmPayment {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus
  ) { }

  @Transactional()
  async handle(command: ConfirmPaymentCommand) {
    const reservation = await this.reservationRepo.findOneById(command.reservationId)

    if (!reservation) {
      throw new NotFoundException('Reservation not found')
    }

    if (reservation.status !== 'HOLD') {
      throw new BadRequestException(`Reservation cannot be confirmed. Current status: ${reservation.status}`)
    }

    if (new Date() > reservation.expiresAt) {
      reservation.status = 'EXPIRED'
      await this.reservationRepo.save(reservation)
      throw new BadRequestException('Reservation HOLD has expired')
    }

    const session = await this.sessionRepo.findOneById(reservation.sessionId)
    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Associated session is no longer active')
    }

    reservation.status = 'CONFIRMED'
    session.status = 'COMPLETED'

    await Promise.all([
      this.reservationRepo.save(reservation),
      this.sessionRepo.save(session)
    ])

    const frontendUrl = this.configService.get('frontendUrl')

    await this.eventBus.publish<ReservationConfirmedPayload>(
      EventQueues.RESERVATION_CONFIRMED,
      {
        reservationId: reservation.id,
        hotelId: session.hotelId,
        roomId: reservation.roomId,
        checkIn: reservation.checkIn.toISOString(),
        checkOut: reservation.checkOut.toISOString(),
        guestName: session.customer?.name ?? 'Cliente',
        guestPhone: session.customer?.phone ?? '',
        guestsCount: session.guests,
        hotelName: session.hotelName,
        bookingLink: `${frontendUrl}/reservation/${reservation.id}`
      }
    )

    return {
      reservationId: reservation.id,
      status: reservation.status
    }
  }
}
