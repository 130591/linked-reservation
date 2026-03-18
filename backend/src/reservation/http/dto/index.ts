
export type Room = {
  id: string
  name: string
}

export type ReservationSession = {
  id: string
  checkIn: Date
  checkOut: Date
  guests: number
  availableRooms: Room[] // snapshot ou dinâmico
  expiresAt: Date
}