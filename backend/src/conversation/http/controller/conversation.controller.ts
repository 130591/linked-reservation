import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common'
import { ConversationService } from '@/conversation/core/service'
import { InboundMessageDto } from '@/conversation/http/dto'
import { TwilioSignatureGuard } from '@/common/integrations/twilio'

@Controller('webhooks')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) { }

  @Post('whatsapp')
  @HttpCode(200)
  @UseGuards(TwilioSignatureGuard)
  async receiveMessage(@Body() dto: InboundMessageDto): Promise<string> {
    await this.conversationService.handle({
      messageId: dto.messageId,
      phone: dto.from,
      stayId: dto.metadata.stayId,
      body: dto.body
    })

    return 'Message processed'
  }
}