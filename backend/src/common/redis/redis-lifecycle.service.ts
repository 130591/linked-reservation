import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { Redis } from 'ioredis'

const QUIT_TIMEOUT_MS = 5_000

@Injectable()
export class RedisLifecycleService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisLifecycleService.name)

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    const start = Date.now()
    try {
      await Promise.race([
        this.redis.quit(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('redis.quit timed out')), QUIT_TIMEOUT_MS).unref(),
        ),
      ])
      this.logger.log({ event: 'redis.shutdown', mode: 'quit', duration_ms: Date.now() - start })
    } catch (error) {
      this.redis.disconnect()
      this.logger.warn({
        event: 'redis.shutdown',
        mode: 'disconnect',
        duration_ms: Date.now() - start,
        reason: (error as Error).message,
      })
    }
  }
}
