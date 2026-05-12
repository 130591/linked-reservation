import { Injectable, Logger, Inject } from '@nestjs/common'
import { ok, err, Result } from 'neverthrow'
import { Transactional } from 'typeorm-transactional'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { EventQueues, ReservationConfirmedPayload } from '@/common/events'
import { ConfigService } from '@/common/config'
import { DomainError } from '@/common/exceptions'
import { ReservationRepository, ReservationSessionRepository } from '@/reservation/persist'
import { BookingReferenceService } from './booking-reference'

export interface ConfirmPaymentCommand {
  paymentIntentId: string
  guestName:       string
  guestEmail:      string
  guestPhone:      string
}

export interface ConfirmPaymentResult {
  reservationId:    string
  bookingReference: string
}

@Injectable()
export class ConfirmPayment {
  private readonly logger = new Logger(ConfirmPayment.name)

  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly bookingRefService: BookingReferenceService,
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  @Transactional()
  async handle(
    command: ConfirmPaymentCommand,
  ): Promise<Result<ConfirmPaymentResult, DomainError>> {
    const reservation = await this.reservationRepo.findByPaymentIntentId(command.paymentIntentId)

    if (!reservation) {
      return err(DomainError.RESERVATION_NOT_FOUND())
    }

    // Idempotency: already CONFIRMED for this intent → return existing reference
    if (reservation.status === 'CONFIRMED') {
      this.logger.log(`ConfirmPayment idempotent hit for intent ${command.paymentIntentId}`)
      return ok({
        reservationId:    reservation.externalId,
        bookingReference: reservation.bookingReference!,
      })
    }

    const session = await this.sessionRepo.findOneById(reservation.sessionId)
    if (!session || session.status !== 'ACTIVE') {
      this.logger.warn(`Session not active for reservation ${reservation.externalId}`)
      return err(DomainError.SESSION_EXPIRED())
    }

    const refResult = await this.bookingRefService.assignToReservation(reservation.id)
    if (refResult.isErr()) return err(refResult.error)
    const bookingReference = refResult.value

    await this.reservationRepo.update(reservation.id, {
      status:          'CONFIRMED',
      paymentIntentId: command.paymentIntentId,
      guestName:       command.guestName,
      guestEmail:      command.guestEmail,
      guestPhone:      command.guestPhone,
    })

    await this.sessionRepo.update(session.id, { status: 'COMPLETED' })

    const frontendUrl = this.configService.get('frontendUrl')

    await this.eventBus.publish<ReservationConfirmedPayload>(
      EventQueues.RESERVATION_CONFIRMED,
      {
        reservationId:    reservation.externalId,
        stayId:           session.stayId,
        roomId:           reservation.roomId,
        checkIn:          reservation.checkIn.toISOString(),
        checkOut:         reservation.checkOut.toISOString(),
        guestName:        command.guestName,
        guestPhone:       command.guestPhone,
        guestsCount:      session.guests,
        stayName:         session.stayName,
        bookingLink:      `${frontendUrl}/reservation/${reservation.externalId}`,
        staffId:          session.staffId,
        bookingReference,
      },
    )

    this.logger.log(`Reservation ${reservation.externalId} confirmed — ref ${bookingReference}`)
    return ok({
      reservationId:    reservation.externalId,
      bookingReference,
    })
  }
}
