import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { SessionExpiredEvent } from './expire-session.consumer'

@Injectable()
export class NotifyStaffConsumer {
  constructor(
    private readonly notificationService: any // NotificationService
  ) { }

  @SqsMessageHandler('reservation.session.expired')
  async handle(message: Message): Promise<void> {
    const { sessionId, staffId } = JSON.parse(message.Body!) as SessionExpiredEvent

    await this.notificationService.notifyStaff(staffId, {
      type: 'SESSION_EXPIRED',
      sessionId
    })
  }
}