import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { SessionExpiredPayload, EventQueues, DomainEvents } from '@/common/events'

@Injectable()
export class NotifyStaffConsumer {
  constructor(
    private readonly notificationService: any // NotificationService
  ) { }

  @SqsMessageHandler(EventQueues.SESSION_EXPIRED)
  async handle(message: Message): Promise<void> {
    const { sessionId, staffId } = JSON.parse(message.Body!) as SessionExpiredPayload

    await this.notificationService.notifyStaff(staffId, {
      type: DomainEvents.SESSION_EXPIRED,
      sessionId
    })
  }
}