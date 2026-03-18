import { Err, Ok, Result } from 'neverthrow'
import { Period } from './period'
import { GuestInfo } from './guest'
import { Room } from './room'
import { DomainError } from './erros/ErrorDomain'

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

type ReservationCommand = {
  checkIn: Date
  checkOut: Date
  guests: GuestInfo[],
  availableRooms: Room[] // snapshot
  expiresAt: Date,
}

export class Reservation {
  private constructor(
    private readonly guestInfo: GuestInfo[],
    private readonly period: Period,
    private readonly status: ReservationStatus,
    private readonly rooms: Room[],
    private readonly totalAmount: number,
  ) { }

  getGuestInfo() {
    return this.guestInfo
  }

  getPeriod() {
    return this.period
  }

  getStatus() {
    return this.status
  }

  getTotalAmount() {
    return this.totalAmount
  }

  getRooms() {
    return this.rooms
  }

  static create(command: ReservationCommand): Result<Reservation, DomainError> {
    const guest = GuestInfo.createFromMap(command.guests)
    const result = Period.create(command.checkIn, command.checkOut)

    return result.map((period) => {
      return new Reservation(
        guest,
        period,
        ReservationStatus.PENDING,
        command.availableRooms,
        this.calculateTotalAmount(command.availableRooms, command.checkIn, command.checkOut),
      )
    })
  }

  private static calculateTotalAmount(rooms: Room[], checkIn: Date, checkOut: Date): number {
    const duration = checkOut.getTime() - checkIn.getTime()
    const totalAmount = rooms.reduce((total, room) => total + room.getPrice(), 0)
    return totalAmount * duration
  }
}