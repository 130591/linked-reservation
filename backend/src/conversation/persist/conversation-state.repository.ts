import { Injectable } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { Redis } from 'ioredis'
import { ConversationState } from '../core/contract/conversation-state'

const STATE_TTL = 60 * 30   // 30min — conversa expira se inativa
const MSG_ID_TTL = 60 * 60   // 1h  — janela de deduplicação de mensagens

@Injectable()
export class ConversationStateRepository {
  constructor(@InjectRedis() private readonly redis: Redis) { }

  private stateKey(phone: string, stayId: string): string {
    return `conv:state:${stayId}:${phone}`
  }

  async find(phone: string, stayId: string): Promise<ConversationState | null> {
    const raw = await this.redis.get(this.stateKey(phone, stayId))
    if (!raw) return null
    return JSON.parse(raw) as ConversationState
  }

  async save(state: ConversationState): Promise<void> {
    await this.redis.set(
      this.stateKey(state.phone, state.stayId),
      JSON.stringify(state),
      'EX',
      STATE_TTL
    )
  }

  async delete(phone: string, stayId: string): Promise<void> {
    await this.redis.del(this.stateKey(phone, stayId))
  }

  private msgKey(messageId: string): string {
    return `conv:msg:${messageId}`
  }

  async isProcessed(messageId: string): Promise<boolean> {
    const exists = await this.redis.exists(this.msgKey(messageId))
    return exists === 1
  }

  async markProcessed(messageId: string): Promise<void> {
    await this.redis.set(this.msgKey(messageId), '1', 'EX', MSG_ID_TTL)
  }
}