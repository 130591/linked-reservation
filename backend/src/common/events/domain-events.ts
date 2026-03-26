import { EventQueues, mapEventToQueue, getQueueUrl } from './queue-mapper'

export const DomainEvents = {
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  RESERVATION_CANCELLED: 'reservation.cancelled',
  SESSION_EXPIRED: 'session.expired',
  SESSION_LINK_GENERATED: 'session.link_generated',
  RESERVATION_REMINDER: 'reservation.reminder',
  CONVERSATION_REPLY: 'conversation.reply',
} as const

export type DomainEventType = typeof DomainEvents[keyof typeof DomainEvents]

// Re-export para manter compatibilidade
export { EventQueues, mapEventToQueue, getQueueUrl }

export interface SessionExpiredPayload {
  sessionId: string
  staffId: string
  stayName: string
  checkIn: string
  checkOut: string
  expiredReason: string
  newSessionUrl: string
}

export interface ReservationConfirmedPayload {
  reservationId: string
  stayId: string
  roomId: string
  checkIn: string
  checkOut: string
  guestName: string
  guestPhone: string
  guestsCount: number
  stayName: string
  bookingLink: string
}

export interface SessionLinkGeneratedPayload {
  sessionId: string
  staffId: string
  token: string
  stayId: string
  customerName: string
  stayName: string
  checkIn: string
  checkOut: string
  bookingLink: string
}

export interface ReservationReminderPayload {
  customerName: string
  stayName: string
  checkIn: string
  checkOut: string
  roomName: string
  bookingLink: string
  guests: number
}

export interface ConversationReplyPayload {
  phone: string
  stayId: string
  message: string
}
