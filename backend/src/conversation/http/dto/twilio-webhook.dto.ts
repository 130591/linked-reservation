import { IsString } from 'class-validator'

export class TwilioWebhookDto {
  @IsString()
  MessageSid: string

  @IsString()
  From: string

  @IsString()
  To: string

  @IsString()
  Body: string
}
