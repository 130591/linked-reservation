import { Injectable } from '@nestjs/common'
import { RoomRepository } from '@/reservation/persist'
import { err, ok } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { GetAvailableRoomsCommand } from '@/reservation/http/dto'


export type GetAvailableRoomsError = {
  type: 'NO_ROOMS_FOR_CAPACITY'
  guests: number
} | {
  type: 'HOTEL_NOT_FOUND'
}

@Injectable()
export class GetAvailableRooms {
  constructor(
    private readonly roomRepo: RoomRepository,
  ) { }

  async handle(command: GetAvailableRoomsCommand) {
    const availableRooms = await this.roomRepo.findAvailableByHotel(
      command.stayId,
      command.guests,
      command.checkIn,
      command.checkOut
    )

    if (availableRooms.length === 0) {
      return err(DomainError.NO_ROOMS_FOR_CAPACITY(command.guests))
    }

    return ok(availableRooms)
  }
}
