import { Injectable } from '@nestjs/common'
import { ConversationNotifier } from '@/conversation/core/contract'
import { NotificationService } from '@/notification/core/service'
import { DomainEvents } from '@/common/events'
import { RecipientType } from '../event'

@Injectable()
export class SyncConversationNotifier implements ConversationNotifier {
  constructor(private readonly notificationService: NotificationService) { }

  async reply(phone: string, stayId: string, message: string, messageId?: string): Promise<void> {
    await this.notificationService.dispatch({
      type: DomainEvents.CONVERSATION_REPLY,
      recipients: [{
        id: phone,
        type: RecipientType.CUSTOMER,
        phone,
        name: 'Cliente'
      }],
      payload: { message, stayId },
      idempotencyKey: messageId,
    })
  }
}