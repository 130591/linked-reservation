import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common'
import { ConversationService } from '../../core/service'
import { InboundMessageDto } from '../dto/inbound-message.dto'

@Controller('webhooks')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name)

  constructor(private readonly conversationService: ConversationService) { }

  @Post('whatsapp')
  @HttpCode(200)
  receiveMessage(@Body() dto: InboundMessageDto): void {
    this.conversationService
      .handle({
        messageId: dto.messageId,
        phone: dto.from,
        stayId: dto.metadata.stayId,
        body: dto.body
      })
      .catch(err =>
        this.logger.error('Unhandled error in ConversationService', err)
      )
  }
}