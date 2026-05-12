/**
 * Maps readable event names (with dots) to valid SQS queue names (with underscores)
 */

export const EventQueues = {
  SESSION_EXPIRED:              'session.expired',
  RESERVATION_CONFIRMED:        'reservation.confirmed',
  SESSION_LINK_GENERATED:       'session.link_generated',
  CONVERSATION_REPLY:           'conversation.reply',
  PROPERTY_PROVISIONED:         'property.provisioned',
  PROPERTY_TRIAL_EXPIRING:      'property.trial.expiring',
  PAYMENT_INTENT_SUCCEEDED:     'payment.intent.succeeded',
  PAYMENT_INTENT_FAILED:        'payment.intent.failed',
} as const

export const QueueNames = {
  SESSION_EXPIRED:              'session_expired',
  RESERVATION_CONFIRMED:        'reservation_confirmed',
  SESSION_LINK_GENERATED:       'session_link_generated',
  CONVERSATION_REPLY:           'conversation_reply',
  PROPERTY_PROVISIONED:         'property_provisioned',
  PROPERTY_TRIAL_EXPIRING:      'property_trial_expiring',
  PAYMENT_INTENT_SUCCEEDED:     'payment_intent_succeeded',
  PAYMENT_INTENT_FAILED:        'payment_intent_failed',
} as const

export type EventQueueType = typeof EventQueues[keyof typeof EventQueues]
export type QueueNameType = typeof QueueNames[keyof typeof QueueNames]

/**
 * Converts event name to SQS queue name
 */
export function mapEventToQueue(eventQueue: EventQueueType): QueueNameType {
  const mapping = {
    [EventQueues.SESSION_EXPIRED]:          QueueNames.SESSION_EXPIRED,
    [EventQueues.RESERVATION_CONFIRMED]:    QueueNames.RESERVATION_CONFIRMED,
    [EventQueues.SESSION_LINK_GENERATED]:   QueueNames.SESSION_LINK_GENERATED,
    [EventQueues.CONVERSATION_REPLY]:       QueueNames.CONVERSATION_REPLY,
    [EventQueues.PROPERTY_PROVISIONED]:     QueueNames.PROPERTY_PROVISIONED,
    [EventQueues.PROPERTY_TRIAL_EXPIRING]:  QueueNames.PROPERTY_TRIAL_EXPIRING,
    [EventQueues.PAYMENT_INTENT_SUCCEEDED]: QueueNames.PAYMENT_INTENT_SUCCEEDED,
    [EventQueues.PAYMENT_INTENT_FAILED]:    QueueNames.PAYMENT_INTENT_FAILED,
  } as const

  return mapping[eventQueue]
}

/**
 * Gets full SQS queue URL
 */
export function getQueueUrl(queueName: QueueNameType, baseUrl: string): string {
  return `${baseUrl}/000000000000/${queueName}`
}
