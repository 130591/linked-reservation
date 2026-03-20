import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { Session } from '@/common/framework/decorators/session.decorator'
import { ReservationSessionEntity } from '@/reservation/persist'
import { GetAvailableRooms, SelectRoom } from '@/reservation/core/service'
import { SelectRoomDto } from '../dto'

@Controller('booking')
export class BookingController {
  constructor(
    private readonly getAvailableRoomsService: GetAvailableRooms,
    private readonly selectRoomService: SelectRoom
  ) { }

  @UseGuards(ReservationTokenGuard)
  @Get('rooms')
  async getAvailableRooms(@Session() session: ReservationSessionEntity) {
    const result = await this.getAvailableRoomsService.handle({
      hotelId: session.hotelId,
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      guests: session.guests
    })

    if (result.isErr()) throw result.error

    return result.value
  }

  @UseGuards(ReservationTokenGuard)
  @Post('select')
  async selectRoom(
    @Session() session: ReservationSessionEntity,
    @Body() body: SelectRoomDto
  ) {
    const result = await this.selectRoomService.handle({
      sessionId: session.id,
      roomId: body.roomId
    })

    if (result.isErr()) throw result.error

    return result.value
  }
}
