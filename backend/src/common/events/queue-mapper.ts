/**
 * Maps readable event names (with dots) to valid SQS queue names (with underscores)
 */

export const EventQueues = {
  SESSION_EXPIRED: 'session.expired',
  RESERVATION_CONFIRMED: 'reservation.confirmed',
  SESSION_LINK_GENERATED: 'session.link_generated',
  CONVERSATION_REPLY: 'conversation.reply',
} as const

export const QueueNames = {
  SESSION_EXPIRED: 'session_expired',
  RESERVATION_CONFIRMED: 'reservation_confirmed',
  SESSION_LINK_GENERATED: 'session_link_generated',
  CONVERSATION_REPLY: 'conversation_reply',
} as const

export type EventQueueType = typeof EventQueues[keyof typeof EventQueues]
export type QueueNameType = typeof QueueNames[keyof typeof QueueNames]

/**
 * Converts event name to SQS queue name
 */
export function mapEventToQueue(eventQueue: EventQueueType): QueueNameType {
  const mapping = {
    [EventQueues.SESSION_EXPIRED]: QueueNames.SESSION_EXPIRED,
    [EventQueues.RESERVATION_CONFIRMED]: QueueNames.RESERVATION_CONFIRMED,
    [EventQueues.SESSION_LINK_GENERATED]: QueueNames.SESSION_LINK_GENERATED,
    [EventQueues.CONVERSATION_REPLY]: QueueNames.CONVERSATION_REPLY,
  } as const

  return mapping[eventQueue]
}

/**
 * Gets full SQS queue URL
 */
export function getQueueUrl(queueName: QueueNameType, baseUrl: string): string {
  return `${baseUrl.replace('localhost:4566', 'sqs.us-east-1.localhost.localstack.cloud:4566')}/000000000000/${queueName}`
}
