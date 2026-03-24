export interface ConversationNotifier {
  reply(phone: string, stayId: string, message: string): Promise<void>
}

export const CONVERSATION_NOTIFIER = Symbol('CONVERSATION_NOTIFIER')