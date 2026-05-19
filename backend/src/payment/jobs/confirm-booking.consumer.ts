import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { PaymentIntentRepository } from '../persist'
import { DomainError } from '@/common/exceptions'
import { EventQueues } from '@/common/events'
import { PaymentIntentStatus } from '../core/domain'
import { ConfirmPayment, ReservationTokenService } from '@/reservation/core/service'
import { ReservationRepository, ReservationSessionEntity, RoomRepository, StayRepository } from '@/reservation/persist'
import { toConfirmationView } from '@/reservation/http/dto'
import { ConfirmPaymentBodyDto } from '@/reservation/http/dto'

@Injectable()
export class ConfirmBookingConsumer {
  constructor(
    private readonly paymentIntentRepo: PaymentIntentRepository,
    private readonly confirmPayment: ConfirmPayment,
    private readonly tokenService: ReservationTokenService,
    private readonly reservationRepo: ReservationRepository,
    private readonly stayRepo: StayRepository,
    private readonly roomRepo: RoomRepository,
  ) {}

  @SqsMessageHandler(EventQueues.CONFIRM_BOOKING)
  async handle(command: ConfirmPaymentBodyDto, session: ReservationSessionEntity) {
    const paymentIntent = await this.paymentIntentRepo.findOneById(command.intentId)
    if (!paymentIntent) throw DomainError.PAYMENT_INTENT_NOT_FOUND()

    if (paymentIntent.status !== PaymentIntentStatus.succeeded) {
      throw DomainError.PAYMENT_REQUIRES_ACTION()
    }

    const confirmResult = await this.confirmPayment.handle({
      paymentIntentId: command.intentId,
      guestName: paymentIntent.customer?.name  ?? '',
      guestEmail: paymentIntent.customer?.email ?? '',
      guestPhone: paymentIntent.customer?.phone ?? '',
    })
    if (confirmResult.isErr()) throw confirmResult.error

    const viewToken = this.tokenService.generateViewToken(confirmResult.value.reservationId)

    const [reservation, stay] = await Promise.all([
      this.reservationRepo.findOneById(confirmResult.value.reservationId),
      this.stayRepo.findOneById(session.stayId),
    ])
    const room = await this.roomRepo.findOneByPk(reservation!.roomId)

    return {
      viewToken,
      confirmation: toConfirmationView(reservation!, room!, stay!, paymentIntent, session),
    }
  }
}