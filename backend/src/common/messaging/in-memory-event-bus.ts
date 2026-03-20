import { Injectable } from '@nestjs/common'
import { EventBus, PublishOptions } from './event-bus.interface'

type Handler<T = unknown> = (payload: T) => Promise<void>

@Injectable()
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Handler>()

  subscribe<T>(queue: string, handler: Handler<T>): void {
    this.handlers.set(queue, handler as Handler)
  }

  async publish<T>(
    queue: string,
    payload: T,
    options?: PublishOptions
  ): Promise<void> {
    const handler = this.handlers.get(queue)
    if (!handler) return

    const delay = (options?.delaySeconds ?? 0) * 1000
    setTimeout(() => handler(payload), delay)
  }
}