import { DomainEventType } from '@/common/events'

export type NotificationEventType = DomainEventType

export enum NotificationChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL'
}

export enum RecipientType {
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER'
}

export interface NotificationRecipient {
  id: string
  type: RecipientType
  phone?: string
  email?: string
  name: string
}

export interface NotificationEvent {
  type: NotificationEventType
  recipients: NotificationRecipient[]
  payload: Record<string, unknown>
  /**
   * Natural idempotency key for dedup (e.g. Twilio MessageSid for replies,
   * SQS MessageId for consumer-driven events). When present, dispatch will
   * not produce a second notification for the same key + recipient + channel.
   * When absent, no dedup is performed.
   */
  idempotencyKey?: string
}