import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { Session } from '@/common/framework/decorators/session.decorator'
import { ReservationSessionEntity } from '@/reservation/persist'
import { GetAvailableRooms, InitiateBookingPayment, SelectRoom } from '@/reservation/core/service'
import { SelectRoomDto, CreatePaymentIntentDto } from '../dto'

@Controller('booking')
export class BookingController {
  constructor(
    private readonly getAvailableRoomsService: GetAvailableRooms,
    private readonly selectRoomService: SelectRoom,
    private readonly initiateBookingPayment: InitiateBookingPayment,
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

}
