
import { LockFixture, makeLockFixture, sleep, waitForCalls } from '../fixture/lock'
import { LockHandle, LockFailure, LockFailureReason } from '@/conversation/core/contract'
import { RedisConversationLock } from '../../libs/lock/redis-conversation-lock'

describe('RedisConversationLock — concurrency (integration)', () => {
  let fixture: LockFixture
  const isHandle = (r: LockHandle | LockFailure): r is LockHandle => 'release' in r

  const PHONE = '+5511999990000'
  const STAY_ID = 'stay-int-test'
  const LOCK_KEY = `lock:conversation:${STAY_ID}:${PHONE}` 
  const OTHER_PHONE = '+5511999990001'

  beforeAll(() => { fixture = makeLockFixture() })

  beforeEach(async () => {
    await fixture.cleanup(LOCK_KEY)
    await fixture.cleanup(OTHER_PHONE)
  })

  afterAll(() => fixture.redis.quit())

  it('serializes two concurrent acquires for the same (phone, stayId): second waits and gets it after the first releases', async () => {
    const setSpy = jest.spyOn(fixture.redis, 'set')
    const { lock } = fixture

    const firstMessage = await lock.acquire(PHONE, STAY_ID)
    expect(isHandle(firstMessage)).toBe(true)
    expect(setSpy.mock.calls).toHaveLength(1)

    const secondMessagePromise = lock.acquire(PHONE, STAY_ID)
    await waitForCalls(setSpy, 2)
    await (firstMessage as LockHandle).release()

    const secondMessage = await secondMessagePromise
    expect(isHandle(secondMessage)).toBe(true)

    await (secondMessage as LockHandle).release()
    expect(await fixture.redis.get(LOCK_KEY)).toBe(null)
  }, 15_000)

  it('allows concurrent acquires for different (phone, stayId) pairs', async () => {
    const [first, second] = await Promise.all([
      fixture.lock.acquire(PHONE, STAY_ID),
      fixture.lock.acquire(OTHER_PHONE, STAY_ID)
    ])
    
    
    expect(isHandle(first)).toBe(true)
    expect(isHandle(second)).toBe(true)
  })

  it('returns CONTENDED to the loser when both compete and one holds the lock past all retries', async () => {
    const [first, second] = await Promise.all([
      fixture.lock.acquire(PHONE, STAY_ID),
      fixture.lock.acquire(PHONE, STAY_ID)
    ])

    const winner = isHandle(first) ? first : second
    const loser = isHandle(first) ? second : first

    expect(loser as LockFailure).toHaveProperty('reason', LockFailureReason.CONTENDED)
    expect(loser as LockFailure).toHaveProperty('attempts', 3)
    const { waitMs } = loser as LockFailure
    expect(waitMs).toBeGreaterThanOrEqual(1500)
    expect(waitMs).toBeLessThan(3000) 
    expect(winner as LockHandle).toBeDefined()
    await (winner as LockHandle).release()
  })

  it('TTL releases an abandoned lock so a later acquire succeeds', async () => {
    const originalTtl = RedisConversationLock.TTL_MS
    RedisConversationLock.TTL_MS = 1_000
    try {
      const abandoned = await fixture.lock.acquire(PHONE, STAY_ID)
      expect(isHandle(abandoned)).toBe(true)
      // Don't call release — simulates a process that died while holding the lock.

      await sleep(1_500)

      const recovered = await fixture.lock.acquire(PHONE, STAY_ID)
      expect(isHandle(recovered)).toBe(true)
      await (recovered as LockHandle).release()
    } finally {
      RedisConversationLock.TTL_MS = originalTtl
    }
  }, 10_000)

  it('release is a no-op when called by a holder whose token was overwritten by TTL takeover', async () => {
    const originalMaxAttempts = RedisConversationLock.MAX_ATTEMPTS
    const originalTtl = RedisConversationLock.TTL_MS
    RedisConversationLock.MAX_ATTEMPTS = 1
    RedisConversationLock.TTL_MS = 1_500
    try {
      const holder = await fixture.lock.acquire(PHONE, STAY_ID)
      expect(isHandle(holder)).toBe(true)
      
      // Wait for TTL to expire and overwrite the token
      await sleep(1_500)
      const second = await fixture.lock.acquire(PHONE, STAY_ID)
      expect(isHandle(second)).toBe(true)
      // Try to release - should be a no-op since token was overwritten
      await (holder as LockHandle).release()

      const third = await fixture.lock.acquire(PHONE, STAY_ID)
      expect(third as LockFailure).toHaveProperty('reason', LockFailureReason.CONTENDED)
      await (second as LockHandle).release()
    } finally {
      RedisConversationLock.MAX_ATTEMPTS = originalMaxAttempts
      RedisConversationLock.TTL_MS = originalTtl
    }
  })
})
