import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConversationStateRepository } from '@/conversation/persist'
import { IntentExtractorService } from './intent-extractor.service'
import { ConversationFlowService } from './conversation-flow.service'
import {
  CONVERSATION_NOTIFIER,
  ConversationNotifier,
  ConversationState
} from '../contract'
import { ReservationAPI } from '@/reservation/external-api'
import { StayRepository } from '@/reservation/persist'

export interface InboundMessage {
  messageId: string
  phone: string
  stayId: string
  body: string
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name)

  constructor(
    private readonly stateRepo: ConversationStateRepository,
    private readonly intentExtractor: IntentExtractorService,
    private readonly flow: ConversationFlowService,
    private readonly reservationAPI: ReservationAPI,
    private readonly hotelRepo: StayRepository,
    @Inject(CONVERSATION_NOTIFIER)
    private readonly notifier: ConversationNotifier
  ) { }

  async handle(message: InboundMessage): Promise<void> {
    const alreadyProcessed = await this.stateRepo.isProcessed(message.messageId)
    if (alreadyProcessed) {
      this.logger.warn(`Duplicate message ignored: ${message.messageId}`)
      return
    }

    await this.stateRepo.markProcessed(message.messageId)
    const currentState =
      await this.stateRepo.find(message.phone, message.stayId) ??
      this.flow.initialState(message.phone, message.stayId)

    if (currentState.step === 'REQUIRES_HUMAN') return
    if (currentState.step === 'LINK_SENT') return

    const intent = await this.intentExtractor.extract(message.body, currentState)

    this.logger.log({
      phone: message.phone,
      step: currentState.step,
      intent: intent.intent,
      confidence: intent.confidence,
      entities: intent.entities
    })

    const result = this.flow.advance(currentState, intent)
    await this.stateRepo.save(result.nextState)

    if (result.ready) {
      await this.handleReady(message, result.nextState)
      return
    }

    await this.notifier.reply(message.phone, message.stayId, result.response)
  }

  private async handleReady(
    message: InboundMessage,
    state: ConversationState
  ): Promise<void> {
    const stay = await this.hotelRepo.findOneById(state.stayId)
    const stayName = stay?.name ?? 'Hotel'

    const linkResult = await this.reservationAPI.generate({
      stayId: state.stayId,
      checkIn: new Date(state.checkIn!),
      checkOut: new Date(state.checkOut!),
      guests: state.guests!,
      staffId: 'system',
      stayName,
      customerName: state.customerName!
    })

    if (linkResult.isErr()) {
      this.logger.error('GenerateLink failed', linkResult.error)

      await this.notifier.reply(
        message.phone,
        message.stayId,
        `Não foi possível gerar o link: ${linkResult.error.message}\n\nTente informar outras datas.`
      )

      await this.stateRepo.save({
        ...state,
        step: 'ASK_DATES',
        checkIn: undefined,
        checkOut: undefined,
        guests: undefined
      })
      return
    }

    const { token, expiresAt } = linkResult.value
    const bookingUrl = `${process.env.BOOKING_BASE_URL}?token=${token}`
    const expiresTime = expiresAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })

    await this.notifier.reply(
      message.phone,
      message.stayId,
      [
        'Perfeito! 🎉 Aqui está seu link de reserva:',
        '',
        `👉 ${bookingUrl}`,
        '',
        `⚠️ Este link expira às ${expiresTime}.`,
        'Escolha seu quarto e finalize a reserva!'
      ].join('\n')
    )

    await this.stateRepo.save({ ...state, step: 'LINK_SENT' })
  }
}