import { Inject, Injectable } from '@nestjs/common'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { ConversationNotifier } from '@/conversation/core/contract'
import { EventQueues, ConversationReplyPayload } from '@/common/events'

@Injectable()
export class AsyncConversationNotifier implements ConversationNotifier {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus
  ) { }

  async reply(phone: string, stayId: string, message: string): Promise<void> {
    await this.eventBus.publish<ConversationReplyPayload>(
      EventQueues.CONVERSATION_REPLY,
      {
        phone,
        stayId,
        message
      }
    )
  }
}