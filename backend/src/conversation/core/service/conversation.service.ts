import { Inject, Injectable, Logger } from '@nestjs/common'
import { err, ok, Result } from 'neverthrow'
import { ConfigService } from '@/common/config/service/config.service'
import { DomainError } from '@/common/exceptions/domain-error'
import { ConversationStateRepository } from '@/conversation/persist'
import { IntentExtractorService } from './intent-extractor.service'
import { ConversationFlowService } from './conversation-flow.service'
import {
  CONVERSATION_NOTIFIER,
  CONVERSATION_LOCK,
  ConversationNotifier,
  ConversationLock,
  ConversationState,
  LockFailureReason,
} from '../contract'
import { ReservationAPI } from '@/reservation/external-api'
import { StayRepository } from '@/reservation/persist'

export interface InboundWhatsAppMessage {
  messageId: string
  from: string
  to: string
  body: string
}

interface ResolvedMessage {
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
    @Inject(CONVERSATION_LOCK)
    private readonly lock: ConversationLock,
  ) {
    this.bookingBaseUrl = this.config.get('bookingBaseUrl')
  }

  async handle(inbound: InboundWhatsAppMessage): Promise<Result<void, DomainError>> {
    const enriched = await this.enrich(inbound)
    if (enriched.isErr()) return err(enriched.error)

    const message = enriched.value

    if (await this.stateRepo.isProcessed(message.messageId)) {
      this.logger.warn(`Duplicate message ignored: ${message.messageId}`)
      return ok(undefined)
    }

    const acquired = await this.lock.acquire(message.phone, message.stayId)
    if ('reason' in acquired) {
      if (acquired.reason === LockFailureReason.CONTENDED) {
        return err(DomainError.MESSAGE_BUSY())
      }
      return await this.runCriticalSection(message)
    }

    try {
      return await this.runCriticalSection(message)
    } finally {
      await acquired.release()
    }
  }

  private async runCriticalSection(message: ResolvedMessage): Promise<Result<void, DomainError>> {
    const state =
      await this.stateRepo.find(message.phone, message.stayId) ??
      this.flow.initialState(message.phone, message.stayId)

    if (BLOCKED_STEPS.has(state.step)) return ok(undefined)

    const intent = await this.intentExtractor.extract(message.body, state)

    this.logger.log({ phone: message.phone, step: state.step, intent: intent.intent, confidence: intent.confidence })

    const result = this.flow.advance(state, intent)
    await this.stateRepo.save(result.nextState)

    if (result.ready) {
      await this.handleReady(message, result.nextState)
    } else {
      await this.notifier.reply(message.phone, message.stayId, result.response, message.messageId)
    }

    await this.stateRepo.markProcessed(message.messageId)
    return ok(undefined)
  }

  private async enrich(inbound: InboundWhatsAppMessage): Promise<Result<ResolvedMessage, DomainError>> {
    const to = inbound.to.startsWith('whatsapp:') ? inbound.to : `whatsapp:${inbound.to}`
    const phone = inbound.from.replace('whatsapp:', '')

    const stayId = await this.reservationAPI.findStayIdByWhatsAppNumber(to)
    if (!stayId) return err(DomainError.CHANNEL_NOT_CONFIGURED(to))

    return ok({ messageId: inbound.messageId, phone, stayId, body: inbound.body })
  }

  private async handleReady(message: ResolvedMessage, state: ConversationState): Promise<void> {
    const [stay, botStaffId] = await Promise.all([
      this.stayRepo.findOneById(state.stayId),
      this.reservationAPI.findBotStaffId(state.stayId),
    ])

    if (!botStaffId) {
      this.logger.error(`No BOT staff member found for stay ${state.stayId}`)
      await this.notifier.reply(message.phone, message.stayId,
        'Não foi possível gerar o link no momento. Por favor, entre em contato diretamente conosco.',
        message.messageId,
      )
      return
    }

    const linkResult = await this.reservationAPI.generate({
      stayId:       state.stayId,
      checkIn:      new Date(state.checkIn!),
      checkOut:     new Date(state.checkOut!),
      guests:       state.guests!,
      staffId:      botStaffId,
      stayName:     stay?.name ?? 'Hotel',
      customerName: state.customerName!,
    })

    if (linkResult.isErr()) {
      this.logger.error('GenerateLink failed', linkResult.error)
      await this.notifier.reply(message.phone, message.stayId,
        `Não foi possível gerar o link: ${linkResult.error.message}\n\nTente informar outras datas.`,
        message.messageId,
      )
      await this.stateRepo.save({ ...state, step: 'ASK_DATES', checkIn: undefined, checkOut: undefined, guests: undefined })
      return
    }

    const { token, expiresAt } = linkResult.value
    this.logger.log(`Link generated — token: ${token}, notifying ${message.phone}`)
    
    await this.notifier.reply(message.phone, message.stayId, this.buildLinkMessage(token, expiresAt), message.messageId)
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