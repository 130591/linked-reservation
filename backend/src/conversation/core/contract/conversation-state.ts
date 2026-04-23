import { MessageParam } from "@anthropic-ai/sdk/resources"

export type ConversationStep =
  | 'INIT'
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
  messageHistory: MessageParam[]
  messageCount: number
  updatedAt: string
}