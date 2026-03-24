import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { NotificationService } from '../core/service/notification-service'
import { NotificationRouter } from '../core/service/notification-router'
import {
  EventQueues,
  DomainEvents,
  ReservationConfirmedPayload,
  SessionLinkGeneratedPayload,
  ConversationReplyPayload
} from '@/common/events'
import { NotificationRecipient, RecipientType } from '../event'

@Injectable()
export class NotificationEventsConsumer {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly router: NotificationRouter
  ) { }

  @SqsMessageHandler(EventQueues.RESERVATION_CONFIRMED)
  async handleReservationConfirmed(message: Message): Promise<void> {
    const payload = JSON.parse(message.Body!) as ReservationConfirmedPayload

    // For RESERVATION_CONFIRMED, we need to notify the guest. 
    // And possibly the staff, based on routing rules.
    const guestRecipient: NotificationRecipient = {
      id: `guest-${payload.reservationId}`,
      type: RecipientType.CUSTOMER,
      name: payload.guestName,
      phone: payload.guestPhone,
      // email doesn't exist yet, but if it did it would be mapped here
    }

    const recipients = await this.router.route({
      stayId: payload.stayId,
      eventType: DomainEvents.RESERVATION_CONFIRMED,
      recipient: guestRecipient,
      now: new Date()
    })

    await this.notificationService.dispatch({
      type: DomainEvents.RESERVATION_CONFIRMED,
      recipients: recipients,
      payload: { ...payload }
    })
  }

  @SqsMessageHandler(EventQueues.SESSION_LINK_GENERATED)
  async handleSessionLinkGenerated(message: Message): Promise<void> {
    const payload = JSON.parse(message.Body!) as SessionLinkGeneratedPayload

    // For link generated, typically we notify the staff who generated it or log it
    // The recipient is the staff member
    const staffRecipient: NotificationRecipient = {
      id: `staff-${payload.staffId}`,
      type: RecipientType.STAFF,
      name: 'Equipe do Hotel',
    }

    const recipients = await this.router.route({
      stayId: payload.stayId,
      eventType: DomainEvents.SESSION_LINK_GENERATED,
      recipient: staffRecipient,
      now: new Date()
    })

    await this.notificationService.dispatch({
      type: DomainEvents.SESSION_LINK_GENERATED,
      recipients: recipients,
      payload: { ...payload }
    })
  }

  @SqsMessageHandler(EventQueues.CONVERSATION_REPLY)
  async handleConversationReply(message: Message): Promise<void> {
    const payload = JSON.parse(message.Body!) as ConversationReplyPayload

    const customerRecipient: NotificationRecipient = {
      id: payload.phone,
      type: RecipientType.CUSTOMER,
      name: 'Cliente',
      phone: payload.phone
    }

    await this.notificationService.dispatch({
      type: DomainEvents.CONVERSATION_REPLY,
      recipients: [customerRecipient],
      payload: { ...payload }
    })
  }
}
