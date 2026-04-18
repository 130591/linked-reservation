import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { InjectRedis } from '@nestjs-modules/ioredis'
import { Redis } from 'ioredis'

const PING_TIMEOUT_MS = 500

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key)
    const start = Date.now()
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timed out')), PING_TIMEOUT_MS).unref(),
        ),
      ])
      return indicator.up({ latency_ms: Date.now() - start })
    } catch (error) {
      return indicator.down({ latency_ms: Date.now() - start, error: (error as Error).message })
    }
  }
}
