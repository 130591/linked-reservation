import { Injectable } from '@nestjs/common'
import { TwilioService } from '@/common/integrations/twilio/twilio.service'
import { NotificationChannel, ChannelSendError } from './channel.interface'
import { Result, ok, err } from 'neverthrow'
import { NotificationError } from '../domain/notification-error'

@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  constructor(private readonly twilioService: TwilioService) {}

  supports(channel: string): boolean {
    return channel === 'WHATSAPP'
  }

  async send(phone: string, body: string): Promise<Result<void, ChannelSendError>> {
    try {
      // Remove 'whatsapp:' prefix se existir
      const cleanPhone = phone.replace('whatsapp:', '')
      
      await this.twilioService.sendWhatsAppText(cleanPhone, body)
      
      return ok(undefined)
    } catch (error) {
      if (error.message?.includes('unsubscribed')) {
        return err(NotificationError.INVALID_DESTINATION('WHATSAPP', phone))
      }
      
      return err(NotificationError.PROVIDER_UNAVAILABLE('WHATSAPP', String(error)))
    }
  }
}