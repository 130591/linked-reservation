export type ConversationStep =
  | 'INIT'
  | 'READY'
  | 'LINK_SENT'
  | 'REQUIRES_HUMAN'

export type ConversationContentBlock =
  | { type: 'text';        text: string; citations?: unknown[] | null }
  | { type: 'tool_use';    id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean; content: string }

export type ConversationMessage = {
  role:    'user' | 'assistant'
  content: ConversationContentBlock[]
}

export interface ConversationState {
  phone: string
  stayId: string
  step: ConversationStep
  checkIn?: string
  checkOut?: string
  guests?: number
  customerName?: string
  messageHistory: ConversationMessage[]
  messageCount: number
  updatedAt: string
}
