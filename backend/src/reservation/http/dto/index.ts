export * from './rooms'
export * from './generate-link'
export * from './reservation'

export type Room = {
  id: string
  name: string
}

export type ReservationSession = {
  id: string
  checkIn: Date
  checkOut: Date
  guests: number
  availableRooms: Room[]
  expiresAt: Date
}

export class SelectRoomDto {
  roomId: string
}