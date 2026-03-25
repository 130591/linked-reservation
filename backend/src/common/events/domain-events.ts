export const DomainEvents = {
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  SESSION_EXPIRED: 'session.expired',
  SESSION_LINK_GENERATED: 'session.link_generated',
  RESERVATION_REMINDER: 'reservation.reminder',
} as const

export type DomainEventType = typeof DomainEvents[keyof typeof DomainEvents]

export const EventQueues = {
  SESSION_EXPIRED: 'reservation.session.expired',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  SESSION_LINK_GENERATED: 'session.link_generated'
} as const

export interface SessionExpiredPayload {
  sessionId: string
  staffId: string
  hotelName: string
  checkIn: string
  checkOut: string
  expiredReason: string
  newSessionUrl: string
}

export interface ReservationConfirmedPayload {
  reservationId: string
  hotelId: string
  roomId: string
  checkIn: string
  checkOut: string
  guestName: string
  guestPhone: string
  guestsCount: number
  hotelName: string
  bookingLink: string
}

export interface SessionLinkGeneratedPayload {
  sessionId: string
  staffId: string
  token: string
  hotelId: string
  customerName: string
  hotelName: string
  checkIn: string
  checkOut: string
  bookingLink: string
}

export interface ReservationReminderPayload {
  customerName: string
  hotelName: string
  checkIn: string
  checkOut: string
  roomName: string
  bookingLink: string
  guests: number
}
