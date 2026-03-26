import { Result } from 'neverthrow'
import { ProviderError, InvalidDestinationError } from '../domain/notification-error'

export type ChannelSendError = ProviderError | InvalidDestinationError

export interface NotificationChannel {
  supports(channel: string): boolean
  send(destination: string, body: string, stayId?: string): Promise<Result<void, ChannelSendError>>
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS')