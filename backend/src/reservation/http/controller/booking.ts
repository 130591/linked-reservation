import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { DomainError } from '@/common/exceptions'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { Session } from '@/common/framework/decorators/session.decorator'
import { ReservationSessionEntity } from '@/reservation/persist'
import { GetAvailableRooms, InitiateBookingPayment, SelectRoom } from '@/reservation/core/service'
import { PaymentAPI } from '@/payment/external-api/payment-api'
import { PaymentIntentRepository } from '@/payment/persist'
import { PaymentIntentStatus } from '@/payment/core/domain'
import { SelectRoomDto, CreatePaymentIntentDto } from '../dto'

@Controller('booking')
export class BookingController {
  constructor(
    private readonly getAvailableRoomsService: GetAvailableRooms,
    private readonly selectRoomService: SelectRoom,
    private readonly paymentAPI: PaymentAPI,
    private readonly initiateBookingPayment: InitiateBookingPayment,
    private readonly paymentIntentRepo: PaymentIntentRepository,
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
    return await this.initiateBookingPayment.handle({
      reservationId: body.reservationId,
      stayName: session.stayName,
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone
    })
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
}
