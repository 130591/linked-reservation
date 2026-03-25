export type ConversationStep =
  | 'INIT'
  | 'ASK_DATES'
  | 'ASK_GUESTS'
  | 'ASK_NAME'
  | 'READY'
  | 'LINK_SENT'
  | 'REQUIRES_HUMAN'

export interface ConversationState {
  phone: string
  stayId: string
  step: ConversationStep
  checkIn?: string
  checkOut?: string
  guests?: number
  customerName?: string
  messageCount: number
  updatedAt: string
}