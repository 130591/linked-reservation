import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ConfigModule, ConfigService } from '@/common/config'
import { TypeOrmPersistenceModule } from '@/common/database/persistence/typeorm-persistence.module'
import { dataSourceOptionsFactory } from '@/common/database/persistence/typeorm-datasource.factory'
import { SqsClientModule } from '@/common/messaging/sqs.module'
import { TwilioModule } from '@/common/integrations/twilio/twilio.module'
import { RedisCacheModule } from '@/common/redis/redis.module'
import { NotificationModule } from './notification/notification.module'
import { ConversationModule } from './conversation/conversation.module'
import { IdentityModule } from './identity/identity.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    SqsClientModule,
    TwilioModule,
    RedisCacheModule,
    ...(process.env.NODE_ENV !== 'test'
      ? [
        TypeOrmPersistenceModule.forRoot({
          inject: [ConfigService],
          useFactory: dataSourceOptionsFactory,
        }),
        NotificationModule,
        ConversationModule,
        IdentityModule,
      ]
      : []),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
