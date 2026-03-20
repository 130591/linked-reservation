import { EventBus, PublishOptions } from "@/common/messaging";

export class FakeEventBus implements EventBus {
  readonly published: { queue: string; payload: any; options?: PublishOptions }[] = []

  async publish<T>(queue: string, payload: T, options?: PublishOptions): Promise<void> {
    this.published.push({ queue, payload, options })
  }
}