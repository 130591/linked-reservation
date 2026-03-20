import { Injectable } from '@nestjs/common'
import { EventBus, PublishOptions } from '../event-bus.interface'
import { OutboxRepository } from './outbox.repository'
import { OutboxEventEntity } from './outbox-event.entity'

@Injectable()
export class OutboxEventBus implements EventBus {
  constructor(private readonly outboxRepo: OutboxRepository) { }

  async publish<T>(
    queue: string,
    payload: T,
    options?: PublishOptions
  ): Promise<void> {
    await this.outboxRepo.save(
      new OutboxEventEntity({
        queue,
        payload: payload as Record<string, unknown>,
        delaySeconds: options?.delaySeconds ?? 0,
        publishedAt: null
      })
    )
  }
}