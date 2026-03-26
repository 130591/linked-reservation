import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { SessionExpiredPayload, EventQueues, DomainEvents } from '@/common/events'
import { NotificationService } from '../core/service'
import { NotificationEvent, RecipientType } from '../event'

@Injectable()
export class NotifyStaffConsumer {
  constructor(
    private readonly notificationService: NotificationService
  ) { }

  @SqsMessageHandler(EventQueues.SESSION_EXPIRED)
  async handle(message: Message): Promise<void> {
    const { sessionId, staffId, stayName } = JSON.parse(message.Body!) as SessionExpiredPayload

    const event: NotificationEvent = {
      type: DomainEvents.SESSION_EXPIRED,
      recipients: [
        {
          id: staffId,
          type: RecipientType.STAFF,
          name: stayName
        }
      ],
      payload: {
        sessionId
      }
    }

    await this.notificationService.dispatch(event)
  }
}