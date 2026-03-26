import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@/common/config'
import { Twilio } from 'twilio'

export interface SendWhatsAppOptions {
  to: string
  body?: string
  contentSid?: string
  contentVariables?: string
}

export interface TwilioMessage {
  sid: string
  accountSid: string
  body: string
  from: string
  to: string
  status: string
  dateCreated: Date
  dateUpdated: Date
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name)
  private readonly client: Twilio

  constructor(private readonly config: ConfigService) {
    this.client = new Twilio(
      this.config.get('twilioAccountSid'),
      this.config.get('twilioAuthToken')
    )
  }

  async sendWhatsApp(options: SendWhatsAppOptions): Promise<TwilioMessage> {
    try {
      const messageData: any = {
        from: this.config.get('twilioWhatsAppFrom'),
        to: `whatsapp:${options.to}`
      }

      // Usa content template se fornecido
      if (options.contentSid) {
        messageData.contentSid = options.contentSid
        if (options.contentVariables) {
          messageData.contentVariables = options.contentVariables
        }
      } else if (options.body) {
        messageData.body = options.body
      } else {
        throw new Error('Either body or contentSid must be provided')
      }

      const message = await this.client.messages.create(messageData)
      
      this.logger.log(`WhatsApp message sent: ${message.sid} to ${options.to}`)
      
      return {
        sid: message.sid,
        accountSid: message.accountSid,
        body: message.body,
        from: message.from,
        to: message.to,
        status: message.status,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated
      }
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${options.to}:`, error)
      throw error
    }
  }

  async sendWhatsAppTemplate(
    to: string,
    contentSid: string,
    variables: Record<string, string>
  ): Promise<TwilioMessage> {
    const contentVariables = JSON.stringify(
      Object.entries(variables).reduce((acc, [key, value], index) => {
        acc[(index + 1).toString()] = value
        return acc
      }, {} as Record<string, string>)
    )

    return this.sendWhatsApp({
      to,
      contentSid,
      contentVariables
    })
  }

  async sendWhatsAppText(to: string, body: string): Promise<TwilioMessage> {
    return this.sendWhatsApp({
      to,
      body
    })
  }
}
