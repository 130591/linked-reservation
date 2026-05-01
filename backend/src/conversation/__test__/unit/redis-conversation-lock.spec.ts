import { RedisConversationLock } from '../../libs/lock/redis-conversation-lock'
import { LockFailureReason } from '../../core/contract'

describe('RedisConversationLock', () => {
  let redis: { set: jest.Mock; eval: jest.Mock }
  let lock: RedisConversationLock

  beforeEach(() => {
    redis = {
      set: jest.fn(),
      eval: jest.fn().mockResolvedValue(1),
    }
    lock = new RedisConversationLock(redis as any)
  })

  it('acquires the lock on the first attempt with NX PX and returns a handle that releases via Lua', async () => {
    redis.set.mockResolvedValueOnce('OK')

    const result = await lock.acquire('+5511999', 'stay-1')

    expect('release' in result).toBe(true)
    const [[key, token, px, ttl, nx]] = redis.set.mock.calls
    expect(key).toBe('lock:conversation:stay-1:+5511999')
    expect(typeof token).toBe('string')
    expect(px).toBe('PX')
    expect(ttl).toBe(30_000)
    expect(nx).toBe('NX')

    await (result as { release: () => Promise<void> }).release()
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, key, token)
  })

  it('returns CONTENDED after exhausting all retry attempts when the key stays held', async () => {
    jest.useFakeTimers()
    redis.set.mockResolvedValue(null)

    const promise = lock.acquire('+5511999', 'stay-1')
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual(expect.objectContaining({ reason: LockFailureReason.CONTENDED, attempts: 3 }))
    expect(redis.set).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  it('returns UNAVAILABLE immediately when Redis throws (fail-open path)', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await lock.acquire('+5511999', 'stay-1')

    expect(result).toEqual(expect.objectContaining({ reason: LockFailureReason.UNAVAILABLE, attempts: 1 }))
    // Fail-open must be fast — no retries on connectivity errors.
    expect(redis.set).toHaveBeenCalledTimes(1)
  })

  it('recovers on a later attempt if the lock becomes free between retries', async () => {
    jest.useFakeTimers()
    redis.set
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('OK')

    const promise = lock.acquire('+5511999', 'stay-1')
    await jest.runAllTimersAsync()
    const result = await promise

    expect('release' in result).toBe(true)
    expect(redis.set).toHaveBeenCalledTimes(2)

    jest.useRealTimers()
  })
})
