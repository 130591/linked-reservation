import Redis from 'ioredis'
import { RedisConversationLock } from '../../infra/redis-conversation-lock'

const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://localhost:6379'

export interface LockFixture {
  redis: Redis
  lock: RedisConversationLock
  cleanup: (...keys: string[]) => Promise<void>
}

export function makeLockFixture(): LockFixture {
  const redis = new Redis(REDIS_URL)
  const lock = new RedisConversationLock(redis as any)
  const cleanup = (...keys: string[]) => redis.del(...keys).then(() => undefined)
  return { redis, lock, cleanup }
}


export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const waitForCalls = (spy: jest.SpyInstance, count: number, timeout: number = 5000) => {
  const start = Date.now()
  return new Promise(function (resolve, reject) {
    const interval = setInterval(() => {
      if (spy.mock.calls.length >= count) {
        clearInterval(interval)
        resolve(true)
      } else if (Date.now() - start > timeout) {
        clearInterval(interval)
        reject(new Error(`Spy não atingiu ${count} chamadas em ${timeout}ms`))
      }
    }, 50)
  })
}