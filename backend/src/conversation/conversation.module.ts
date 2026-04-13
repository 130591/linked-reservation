import { Module } from '@nestjs/common'
import { ReservationModule } from '@/reservation/reservation.module'
import { NotificationModule } from '@/notification/notification.module'
import { ConversationController } from './http/controller/conversation.controller'
import { SyncConversationNotifier } from '@/notification/external-api'
import { AsyncConversationNotifier } from '@/notification/external-api'
import { ConversationService } from './core/service'
import { ConversationFlowService } from './core/service'
import { IntentExtractorService } from './core/service'
import { ConversationStateRepository } from './persist'
import { StayRepository } from '@/reservation/persist/repositories/stay.repository'
import { CONVERSATION_NOTIFIER } from './core/contract'
import { SqsEventBus } from '@/common/messaging/sqs-event-bus'
import { EVENT_BUS } from '@/common/messaging/event-bus.interface'

@Module({
  imports: [
    ReservationModule,
    NotificationModule,
  ],
  controllers: [
    ConversationController
  ],
  providers: [
    ConversationService,
    ConversationFlowService,
    IntentExtractorService,
    ConversationStateRepository,
    StayRepository,
    SyncConversationNotifier,
    AsyncConversationNotifier,
    SqsEventBus,
    {
      provide: EVENT_BUS,
      useClass: SqsEventBus
    },
    {
      provide: CONVERSATION_NOTIFIER,
      useClass: SyncConversationNotifier
    }
  ]
})
export class ConversationModule { }