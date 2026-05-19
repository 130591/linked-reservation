import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { ConfigModule } from '@/common/config'
import { SqsClientModule } from '@/common/messaging/sqs.module'
import { TwilioModule } from '@/common/integrations/twilio/twilio.module'
import { RedisCacheModule } from '@/common/redis/redis.module'
import { HealthModule } from '@/common/health'
import { NotificationModule } from './notification/notification.module'
import { ConversationModule } from './conversation/conversation.module'
import { IdentityModule } from './identity/identity.module'
import { ReservationModule } from './reservation/reservation.module'
import { PaymentModule } from './payment/payment.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    SqsClientModule,
    TwilioModule,
    RedisCacheModule,
    HealthModule,
    ...(process.env.NODE_ENV !== 'test'
      ? [
        NotificationModule,
        ConversationModule,
        IdentityModule,
        ReservationModule,
        PaymentModule,
      ]
      : []),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
