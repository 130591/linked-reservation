import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { RedisHealthIndicator } from './indicators/redis.health'
import { ShutdownLoggerService } from './shutdown-logger.service'

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, ShutdownLoggerService],
})
export class HealthModule {}
