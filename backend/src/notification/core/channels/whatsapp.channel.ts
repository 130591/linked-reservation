import { Injectable, Logger } from '@nestjs/common'
import { TwilioService } from '@/common/integrations/twilio/twilio.service'
import { NotificationChannel, ChannelSendError } from './channel.interface'
import { Result, ok, err } from 'neverthrow'
import { NotificationError } from '../domain/notification-error'
import { ConfigService } from '@/common/config'
import { ReservationAPI } from '@/reservation/external-api'

@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name)

  constructor(
    private readonly twilioService: TwilioService,
    private readonly config: ConfigService,
    private readonly reservationApi: ReservationAPI,
  ) {}

  supports(channel: string): boolean {
    return channel.toUpperCase() === 'WHATSAPP'
  }

  async send(destination: string, body: string, stayId?: string): Promise<Result<void, ChannelSendError>> {
    try {
      let fromNumber: string

      if (stayId) {
        const whatsappNumber = await this.reservationApi.findWhatsAppNumber(stayId)
        if (whatsappNumber) {
          fromNumber = whatsappNumber
          this.logger.log(`Using hotel-specific WhatsApp number for stay ${stayId}: ${fromNumber}`)
        } else {
          this.logger.warn(`Stay ${stayId} has no WhatsApp number, using default`)
          fromNumber = this.config.get('twilioWhatsAppFrom')
        }
      } else {
        fromNumber = this.config.get('twilioWhatsAppFrom')
      }

      await this.twilioService.sendWhatsApp({
        to: destination,
        body,
        from: fromNumber
      })
      
      this.logger.log(`WhatsApp message sent to ${destination} from ${fromNumber}`)
      
      return ok(undefined)
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp to ${destination}:`, error)
      if (error.message?.includes('unsubscribed')) {
        return err(NotificationError.INVALID_DESTINATION('WHATSAPP', destination))
      }
      
      return err(NotificationError.PROVIDER_UNAVAILABLE('WHATSAPP', String(error)))
    }
  }
}