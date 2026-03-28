import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@/common/config/service/config.service'
import { ConversationStateRepository } from '@/conversation/persist'
import { IntentExtractorService } from './intent-extractor.service'
import { ConversationFlowService } from './conversation-flow.service'
import { CONVERSATION_NOTIFIER, ConversationNotifier, ConversationState } from '../contract'
import { ReservationAPI } from '@/reservation/external-api'
import { StayRepository } from '@/reservation/persist'

export interface InboundMessage {
  messageId: string
  phone: string
  stayId: string
  body: string
}

const BLOCKED_STEPS = new Set(['REQUIRES_HUMAN', 'LINK_SENT'])

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name)
  private readonly bookingBaseUrl: string

  constructor(
    private readonly stateRepo: ConversationStateRepository,
    private readonly intentExtractor: IntentExtractorService,
    private readonly flow: ConversationFlowService,
    private readonly reservationAPI: ReservationAPI,
    private readonly stayRepo: StayRepository,
    private readonly config: ConfigService,
    @Inject(CONVERSATION_NOTIFIER)
    private readonly notifier: ConversationNotifier,
  ) {
    this.bookingBaseUrl = this.config.get('bookingBaseUrl')
  }

  async handle(message: InboundMessage): Promise<void> {
    if (await this.stateRepo.isProcessed(message.messageId)) {
      this.logger.warn(`Duplicate message ignored: ${message.messageId}`)
      return
    }

    await this.stateRepo.markProcessed(message.messageId)

    const state =
      await this.stateRepo.find(message.phone, message.stayId) ??
      this.flow.initialState(message.phone, message.stayId)

    if (BLOCKED_STEPS.has(state.step)) return

    const intent = await this.intentExtractor.extract(message.body, state)

    this.logger.log({ phone: message.phone, step: state.step, intent: intent.intent, confidence: intent.confidence })

    const result = this.flow.advance(state, intent)
    await this.stateRepo.save(result.nextState)

    if (result.ready) {
      await this.handleReady(message, result.nextState)
      return
    }

    await this.notifier.reply(message.phone, message.stayId, result.response)
  }

  private async handleReady(message: InboundMessage, state: ConversationState): Promise<void> {
    const stay = await this.stayRepo.findOneById(state.stayId)

    const linkResult = await this.reservationAPI.generate({
      stayId:       state.stayId,
      checkIn:      new Date(state.checkIn!),
      checkOut:     new Date(state.checkOut!),
      guests:       state.guests!,
      staffId:      'system',
      stayName:     stay?.name ?? 'Hotel',
      customerName: state.customerName!,
    })

    if (linkResult.isErr()) {
      this.logger.error('GenerateLink failed', linkResult.error)
      await this.notifier.reply(message.phone, message.stayId,
        `Não foi possível gerar o link: ${linkResult.error.message}\n\nTente informar outras datas.`
      )
      await this.stateRepo.save({ ...state, step: 'ASK_DATES', checkIn: undefined, checkOut: undefined, guests: undefined })
      return
    }

    const { token, expiresAt } = linkResult.value
    await this.notifier.reply(message.phone, message.stayId, this.buildLinkMessage(token, expiresAt))
    await this.stateRepo.save({ ...state, step: 'LINK_SENT' })
  }

  private buildLinkMessage(token: string, expiresAt: Date): string {
    const url = `${this.bookingBaseUrl}?token=${token}`
    const expireAt = expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    return [
      'Perfeito! 🎉 Aqui está seu link de reserva:',
      '',
      `👉 ${url}`,
      '',
      `⚠️ Este link expira às ${expireAt}.`,
      'Escolha seu quarto e finalize a reserva!',
    ].join('\n')
  }
}