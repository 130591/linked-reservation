import { Injectable } from '@nestjs/common'
import { RoomRepository, ReservationRepository } from '@/reservation/persist'
import { MoreThanOrEqual } from 'typeorm'
import { err, ok } from 'neverthrow'
import { DomainError } from '@/common/exceptions'

export interface GetAvailableRoomsCommand {
  hotelId: string
  checkIn: Date
  checkOut: Date
  guests: number
}

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
    private readonly reservationRepo: ReservationRepository
  ) { }

  async handle(command: GetAvailableRoomsCommand) {
    const allRooms = await this.roomRepo.find({
      where: {
        hotelId: command.hotelId,
        capacity: MoreThanOrEqual(command.guests)
      }
    })

    if (allRooms.length === 0) {
      return err(DomainError.NO_ROOMS_FOR_CAPACITY(command.guests))
    }

    const activeReservations = await this.reservationRepo.findActiveReservations(command.checkIn, command.checkOut)
    const occupiedRoomIds = new Set(activeReservations.map(res => res.roomId))
    const availableRooms = allRooms.filter(room => !occupiedRoomIds.has(room.id))

    return ok(availableRooms)
  }
}
