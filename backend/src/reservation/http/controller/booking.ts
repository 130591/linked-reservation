import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { Session } from '@/common/framework/decorators/session.decorator'
import { ReservationSessionEntity } from '@/reservation/persist'
import { ReservationRepository, RoomRepository, ReservationSessionRepository, StayRepository } from '@/reservation/persist'
import { GetAvailableRooms, SelectRoom } from '@/reservation/core/service'
import { ConfirmPayment } from '@/reservation/core/service'
import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { PaymentAPI } from '@/payment/external-api/payment-api'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { PaymentIntentStatus } from '@/payment/core/domain'
import { DomainError } from '@/common/exceptions'
import { ConfigService } from '@/common/config'
import { SelectRoomDto, CreatePaymentIntentDto, ConfirmPaymentBodyDto, toConfirmationView } from '../dto'

@Controller('booking')
export class BookingController {
  constructor(
    private readonly getAvailableRoomsService: GetAvailableRooms,
    private readonly selectRoomService: SelectRoom,
    private readonly paymentAPI: PaymentAPI,
    private readonly confirmPayment: ConfirmPayment,
    private readonly tokenService: ReservationTokenService,
    private readonly reservationRepo: ReservationRepository,
    private readonly roomRepo: RoomRepository,
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly stayRepo: StayRepository,
    private readonly paymentIntentRepo: PaymentIntentRepository,
    private readonly configService: ConfigService,
  ) { }

  @UseGuards(ReservationTokenGuard)
  @Get('rooms')
  async getAvailableRooms(@Session() session: ReservationSessionEntity) {
    const result = await this.getAvailableRoomsService.handle({
      stayId: session.stayId,
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      guests: session.guests
    })

    if (result.isErr()) throw result.error

    return result.value.map(room => ({
      id:            room.externalId,
      name:          room.name,
      capacity:      room.capacity,
      pricePerNight: room.pricePerNight,
    }))
  }

  @UseGuards(ReservationTokenGuard)
  @Post('select')
  async selectRoom(
    @Session() session: ReservationSessionEntity,
    @Body() body: SelectRoomDto
  ) {
    const result = await this.selectRoomService.handle({
      sessionId: session.externalId,
      roomId: body.roomId
    })

    if (result.isErr()) throw result.error

    return result.value
  }

  @UseGuards(ReservationTokenGuard)
  @Post('payment-intent')
  async createPaymentIntent(
    @Session() session: ReservationSessionEntity,
    @Body() body: CreatePaymentIntentDto,
  ) {
    const reservation = await this.reservationRepo.findOneById(body.reservationId)
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
      reservationId: body.reservationId,
      amountCents,
      description:   `Reserva ${session.stayName}`,
      guest: {
        name:  body.guestName,
        email: body.guestEmail,
        phone: body.guestPhone,
      },
    })
    if (result.isErr()) throw result.error

    return {
      ...result.value,
      publishableKey: this.configService.get('stripePublishableKey'),
    }
  }

  @UseGuards(ReservationTokenGuard)
  @Get('payment-status')
  async getPaymentStatus(@Query('intentId') intentId: string) {
    const intent = await this.paymentIntentRepo.findOneById(intentId)
    if (!intent) throw DomainError.PAYMENT_INTENT_NOT_FOUND()

    const ageMs = Date.now() - intent.createdAt.getTime()
    if (intent.status === PaymentIntentStatus.pending && ageMs > 90_000) {
      const refreshResult = await this.paymentAPI.refreshFromProvider(intentId)
      if (refreshResult.isErr()) throw refreshResult.error
      const newStatus = refreshResult.value.status
      return {
        status: newStatus,
        succeededAt: newStatus === PaymentIntentStatus.succeeded ? new Date() : null,
      }
    }

    return { status: intent.status, succeededAt: intent.confirmedAt }
  }

  @UseGuards(ReservationTokenGuard)
  @Post('confirmation')
  async confirmBooking(
    @Session() session: ReservationSessionEntity,
    @Body() body: ConfirmPaymentBodyDto,
  ) {
    const paymentIntent = await this.paymentIntentRepo.findOneById(body.intentId)
    if (!paymentIntent) throw DomainError.PAYMENT_INTENT_NOT_FOUND()

    if (paymentIntent.status !== PaymentIntentStatus.succeeded) {
      throw DomainError.PAYMENT_REQUIRES_ACTION()
    }

    const confirmResult = await this.confirmPayment.handle({
      paymentIntentId: body.intentId,
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
