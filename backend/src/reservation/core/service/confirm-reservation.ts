import { BadGatewayException, Injectable } from '@nestjs/common'
import { ReservationRepository, ReservationEntity } from '../../persist'
import { Reservation, GuestInfo, Room } from '../domain'

interface ConfirmReservationCommand {
  checkIn: Date
  checkOut: Date
  guests: GuestInfo[]
  availableRooms: Room[]
  expiresAt: Date,
}


@Injectable()
export class ConfirmReservation {
  constructor(private readonly reservationRepository: ReservationRepository) { }

  async handle(command: ConfirmReservationCommand) {
    const reservationOrError = Reservation.create({
      checkIn: command.checkIn,
      checkOut: command.checkOut,
      guests: command.guests,
      availableRooms: command.availableRooms,
      expiresAt: command.expiresAt,
    })

    if (reservationOrError.isErr()) {
      const error = reservationOrError.error
      throw new BadGatewayException({
        code: error.code,
        message: error.message
      })
    }

    const reservation = reservationOrError.value
    const entity = ReservationEntity.fromDomain(reservation)
    await this.reservationRepository.save(entity)
  }
}