import { Module } from '@nestjs/common'
import { NotifyStaffConsumer } from './jobs'
import { NotificationEventsConsumer } from './jobs/notification-events.consumer'
import { TemplateRenderer } from './core/domain/template-renderer'
import { TemplateValidator } from './core/domain/template-validator'
import { NotificationService, NotificationRouter } from './core/service'
import { RoutingRuleRepository, NotificationRepository } from './persist'
import { WhatsAppChannel, EmailChannel, NOTIFICATION_CHANNELS } from './core/channels'

@Module({
  providers: [
    TemplateRenderer,
    TemplateValidator,
    NotificationRouter,
    NotificationService,
    RoutingRuleRepository,
    NotificationRepository,
    NotifyStaffConsumer,
    NotificationEventsConsumer,
    WhatsAppChannel,
    EmailChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (w: WhatsAppChannel, e: EmailChannel) => [w, e],
      inject: [WhatsAppChannel, EmailChannel]
    }
  ],
  exports: [NotificationService]
})
export class NotificationModule { }