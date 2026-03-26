import { Controller, Post, Body, HttpCode, Logger, Headers } from '@nestjs/common'
import { ConversationService } from '../../core/service'
import { InboundMessageDto } from '../dto/inbound-message.dto'

@Controller('webhooks')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name)

  constructor(private readonly conversationService: ConversationService) { }

  @Post('whatsapp')
  @HttpCode(200)
  async receiveMessage(
    @Body() dto: InboundMessageDto,
    @Headers('x-twilio-signature') signature: string
  ): Promise<string> {
    try {
      // Valida assinatura do Twilio (opcional para desenvolvimento)
      // if (!this.isValidSignature(dto, signature)) {
      //   return 'Invalid signature'
      // }

      // Processa a mensagem através do ConversationService
      await this.conversationService.handle({
        messageId: dto.messageId,
        phone: dto.from,
        stayId: dto.metadata.stayId,
        body: dto.body
      })

      return 'Message processed'
    } catch (error) {
      this.logger.error('Error processing WhatsApp webhook:', error)
      return 'Error processing message'
    }
  }

  private isValidSignature(body: any, signature: string): boolean {
    // Implementar validação de assinatura do Twilio se necessário
    return true
  }
}