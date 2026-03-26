import { Injectable } from '@nestjs/common'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ConfigService } from '@/common/config'
import { NotificationChannel, ChannelSendError } from './channel.interface'
import { Result, ok, err } from 'neverthrow'
import { NotificationError } from '../domain/notification-error'

@Injectable()
export class EmailChannel implements NotificationChannel {
  private readonly client: SESClient
  private readonly from: string

  constructor(private readonly config: ConfigService) {
    this.client = new SESClient({ region: this.config.get('awsRegion') })
    this.from = this.config.get('sesFromEmail')
  }

  supports(channel: string): boolean {
    return channel === 'EMAIL'
  }

  async send(email: string, body: string, stayId?: string): Promise<Result<void, ChannelSendError>> {
    try {
      await this.client.send(new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Linked Reservation' },
          Body: { Text: { Data: body } }
        }
      }))

      return ok(undefined)
    } catch (error: any) {
      if (error?.name === 'MessageRejected') {
        return err(NotificationError.INVALID_DESTINATION('EMAIL', email))
      }

      return err(NotificationError.PROVIDER_UNAVAILABLE('EMAIL', String(error)))
    }
  }
}