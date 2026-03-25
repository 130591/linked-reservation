import { Injectable } from '@nestjs/common'
import { ConfigService } from '@/common/config'
import { NotificationChannel, ChannelSendError } from './channel.interface'
import { Result, ok, err } from 'neverthrow'
import { NotificationError } from '../domain/notification-error'


@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  private readonly apiUrl: string
  private readonly apiKey: string

  constructor(private readonly config: ConfigService) {
    this.apiUrl = this.config.get('whatsappApiUrl')
    this.apiKey = this.config.get('whatsappApiKey')
  }

  supports(channel: string): boolean {
    return channel === 'WHATSAPP'
  }

  async send(phone: string, body: string): Promise<Result<void, ChannelSendError>> {
    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ to: phone, text: body })
      })

      if (response.status === 400) {
        return err(NotificationError.INVALID_DESTINATION('WHATSAPP', phone))
      }

      if (!response.ok) {
        return err(NotificationError.PROVIDER_UNAVAILABLE('WHATSAPP', `HTTP ${response.status}`))
      }

      return ok(undefined)
    } catch (error) {
      return err(NotificationError.PROVIDER_UNAVAILABLE('WHATSAPP', String(error)))
    }
  }
}