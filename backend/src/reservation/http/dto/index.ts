export * from './rooms'
export * from './generate-link'
export * from './reservation'
export * from './create-payment-intent.dto'
export * from './confirmation-view'

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