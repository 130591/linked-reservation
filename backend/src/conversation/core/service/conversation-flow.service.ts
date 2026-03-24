import { Injectable } from '@nestjs/common'
import { ConversationState } from '../contract/conversation-state'
import { ExtractedIntent } from '../contract/intent'

const MAX_MESSAGES_BEFORE_HUMAN = 8
const CONFIDENCE_THRESHOLD = 0.5

export interface FlowResult {
  nextState: ConversationState
  response: string
  requiresHuman: boolean
  ready: boolean
}

@Injectable()
export class ConversationFlowService {

  initialState(phone: string, stayId: string): ConversationState {
    return {
      phone,
      stayId,
      step: 'INIT',
      messageCount: 0,
      updatedAt: new Date().toISOString()
    }
  }

  advance(state: ConversationState, intent: ExtractedIntent): FlowResult {
    if (state.messageCount >= MAX_MESSAGES_BEFORE_HUMAN) {
      return this.requireHuman(state)
    }
    if (intent.confidence < CONFIDENCE_THRESHOLD && intent.intent === 'UNKNOWN') {
      return this.handleUnknown(state)
    }
    if (intent.intent === 'CANCEL') {
      return this.cancel(state)
    }

    const updated: ConversationState = {
      ...state,
      checkIn: intent.entities.checkIn?.toISOString() ?? state.checkIn,
      checkOut: intent.entities.checkOut?.toISOString() ?? state.checkOut,
      guests: intent.entities.guests ?? state.guests,
      customerName: intent.entities.customerName ?? state.customerName,
      messageCount: state.messageCount + 1,
      updatedAt: new Date().toISOString()
    }

    if (updated.checkIn && updated.checkOut && updated.guests && updated.customerName) {
      return {
        nextState: { ...updated, step: 'READY' },
        response: '',
        requiresHuman: false,
        ready: true
      }
    }

    if (!updated.checkIn || !updated.checkOut) {
      return {
        nextState: { ...updated, step: 'ASK_DATES' },
        response: this.askDatesMessage(intent.intent),
        requiresHuman: false,
        ready: false
      }
    }

    if (!updated.guests) {
      return {
        nextState: { ...updated, step: 'ASK_GUESTS' },
        response: 'Para quantas pessoas é a reserva? 👥',
        requiresHuman: false,
        ready: false
      }
    }

    if (!updated.customerName) {
      return {
        nextState: { ...updated, step: 'ASK_NAME' },
        response: 'E para quem seria a reserva? Por favor, me informe seu nome completo. 😊',
        requiresHuman: false,
        ready: false
      }
    }

    return this.requireHuman(state)
  }

  private askDatesMessage(intent: string): string {
    if (intent === 'GREETING') {
      return [
        'Olá! 👋 Bem-vindo!',
        'Para quais datas você gostaria de reservar? 📅',
        'Ex: "de 10 a 12 de abril"'
      ].join('\n\n')
    }
    return 'Para quais datas você gostaria de reservar? 📅\n\nEx: "de 10 a 12 de abril"'
  }

  private handleUnknown(state: ConversationState): FlowResult {
    if (state.messageCount < 3) {
      return {
        nextState: { ...state, messageCount: state.messageCount + 1 },
        response: 'Não entendi bem. 😅\n\nPode me dizer as datas da sua estadia?\nEx: "de 10 a 12 de abril"',
        requiresHuman: false,
        ready: false
      }
    }

    return this.requireHuman(state)
  }

  private requireHuman(state: ConversationState): FlowResult {
    return {
      nextState: { ...state, step: 'REQUIRES_HUMAN' },
      response: 'Vou chamar um atendente para te ajudar melhor. Um momento! 👋',
      requiresHuman: true,
      ready: false
    }
  }

  private cancel(state: ConversationState): FlowResult {
    return {
      nextState: {
        ...state,
        step: 'INIT',
        checkIn: undefined,
        checkOut: undefined,
        guests: undefined,
        customerName: undefined,
        messageCount: 0
      },
      response: 'Tudo bem! Se precisar, é só chamar. 😊',
      requiresHuman: false,
      ready: false
    }
  }
}