import { Module, Global } from '@nestjs/common'
import { RedisModule as IoRedisModule } from '@nestjs-modules/ioredis'
import { ConfigService } from '@/common/config'
import { RedisLifecycleService } from './redis-lifecycle.service'

@Global()
@Module({
  imports: [
    IoRedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        options: {
          host: 'localhost',
          port: 6379,
        },
      }),
    }),
  ],
  providers: [RedisLifecycleService],
  exports: [IoRedisModule],
})
export class RedisCacheModule {}
