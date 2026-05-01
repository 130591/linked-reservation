import { Injectable, Logger } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { Redis } from 'ioredis'
import { randomUUID } from 'crypto'
import {
  ConversationLock,
  LockHandle,
  LockFailure,
  LockFailureReason,
} from '../../core/contract'

// Compare-and-delete: avoids releasing a lock a slow handler lost to TTL.
const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

@Injectable()
export class RedisConversationLock implements ConversationLock {
  private readonly logger = new Logger(RedisConversationLock.name)

  static TTL_MS = 30_000
  static MAX_ATTEMPTS = 3
  static BASE_BACKOFF_MS = 500

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async acquire(phone: string, stayId: string): Promise<LockHandle | LockFailure> {
    const key = `lock:conversation:${stayId}:${phone}`
    const token = randomUUID()
    const start = Date.now()

    for (let attempt = 1; attempt <= RedisConversationLock.MAX_ATTEMPTS; attempt++) {
      let acquired: 'OK' | null
      try {
        acquired = await this.redis.set(key, token, 'PX', RedisConversationLock.TTL_MS, 'NX')
      } catch (error) {
        this.logger.warn({
          event: 'lock.fail_open', key, attempts: attempt, error: (error as Error).message,
        })
        return { reason: LockFailureReason.UNAVAILABLE, attempts: attempt, waitMs: Date.now() - start }
      }

      if (acquired === 'OK') {
        this.logger.debug({ event: 'lock.acquired', key, attempts: attempt, waitMs: Date.now() - start })
        return this.makeHandle(key, token)
      }

      if (attempt < RedisConversationLock.MAX_ATTEMPTS) {
        await sleep(this.backoffMs(attempt))
      }
    }

    const waitMs = Date.now() - start
    this.logger.warn({ event: 'lock.contended', key, attempts: RedisConversationLock.MAX_ATTEMPTS, waitMs })
    return { reason: LockFailureReason.CONTENDED, attempts: RedisConversationLock.MAX_ATTEMPTS, waitMs }
  }

  private backoffMs(attempt: number): number {
    const exp = RedisConversationLock.BASE_BACKOFF_MS * Math.pow(2, attempt - 1)
    const jitter = Math.random() * RedisConversationLock.BASE_BACKOFF_MS
    return Math.floor(exp + jitter)
  }

  private makeHandle(key: string, token: string): LockHandle {
    return {
      release: async () => {
        try {
          await this.redis.eval(RELEASE_LUA, 1, key, token)
        } catch (error) {
          // Not fatal: TTL cleans up. Logged to surface systemic failures.
          this.logger.warn({ event: 'lock.release_failed', key, error: (error as Error).message })
        }
      },
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
