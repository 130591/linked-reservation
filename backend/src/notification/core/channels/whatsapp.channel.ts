import { Injectable, Logger } from '@nestjs/common'
import { TwilioService } from '@/common/integrations/twilio/twilio.service'
import { NotificationChannel, ChannelSendError } from './channel.interface'
import { Result, ok, err } from 'neverthrow'
import { NotificationError } from '../domain/notification-error'
import { ConfigService } from '@/common/config'
import { StayRepository } from '@/reservation/persist/repositories/stay.repository'

@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name)

  constructor(
    private readonly twilioService: TwilioService,
    private readonly config: ConfigService,
    private readonly stayRepo: StayRepository
  ) {}

  supports(channel: string): boolean {
    return channel.toUpperCase() === 'WHATSAPP'
  }

  async send(destination: string, body: string, stayId?: string): Promise<Result<void, ChannelSendError>> {
    try {
      let fromNumber: string

      // Se tem stayId, usa número específico do hotel
      if (stayId) {
        const stay = await this.stayRepo.findOneById(stayId)
        if (stay?.whatsappNumber) {
          fromNumber = stay.whatsappNumber
          this.logger.log(`Using WhatsApp number for hotel: ${stay.name} (${fromNumber})`)
        } else {
          this.logger.warn(`Hotel ${stayId} has no WhatsApp number, using default`)
          fromNumber = this.config.get('twilioWhatsAppFrom')
        }
      } else {
        // Sem stayId, usa configuração padrão
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