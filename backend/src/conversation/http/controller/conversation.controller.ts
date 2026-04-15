import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common'
import { ConversationService } from '@/conversation/core/service'
import { TwilioWebhookDto } from '@/conversation/http/dto'
import { TwilioSignatureGuard } from '@/common/integrations/twilio'

@Controller('webhooks')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
  ) { }

  @Post('whatsapp')
  @HttpCode(200)
  @UseGuards(TwilioSignatureGuard)
  async receiveMessage(@Body() dto: TwilioWebhookDto): Promise<string> {
    const result = await this.conversationService.handle({
      messageId: dto.MessageSid,
      from: dto.From,
      to: dto.To,
      body: dto.Body,
    })

    if (result.isErr()) throw result.error

    return 'Message processed'
  }
}
