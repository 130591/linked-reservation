import { ReservationRepository, ReservationSessionRepository } from '@/reservation/persist'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Transactional } from 'typeorm-transactional'

interface ConfirmPaymentCommand {
  reservationId: string
  paymentId: string
}

@Injectable()
export class ConfirmPayment {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly sessionRepo: ReservationSessionRepository
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

    return {
      reservationId: reservation.id,
      status: reservation.status
    }
  }
}
