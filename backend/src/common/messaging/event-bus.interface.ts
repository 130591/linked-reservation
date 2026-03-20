export interface PublishOptions {
  delaySeconds?: number  // SQS suport until 900s (15min) natively
}

export interface EventBus {
  publish<T>(queue: string, payload: T, options?: PublishOptions): Promise<void>
}

export const EVENT_BUS = Symbol('EVENT_BUS')