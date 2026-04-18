export interface LockHandle {
  release(): Promise<void>
}

export enum LockFailureReason {
  /** Redis reachable but another worker holds the lock and retries are exhausted. */
  CONTENDED = 'CONTENDED',
  /** Redis unreachable or erroring. Callers fail-open (process without lock). */
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface LockFailure {
  reason: LockFailureReason
  attempts: number
  waitMs: number
}

export interface ConversationLock {
  /**
   * Attempts to acquire a mutex for (phone, stayId). Implementations must
   * distinguish contention (another worker holds the key) from availability
   * errors (Redis down / timeout) via LockFailure.reason.
   */
  acquire(phone: string, stayId: string): Promise<LockHandle | LockFailure>
}

export const CONVERSATION_LOCK = Symbol('CONVERSATION_LOCK')
