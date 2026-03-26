import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SqsModule } from '@ssut/nestjs-sqs'
import { ConfigService } from '@/common/config'
import { SQSClient } from '@aws-sdk/client-sqs'
import { EventQueues, mapEventToQueue, getQueueUrl } from '@/common/events'
import { NotifyStaffConsumer } from './jobs'
import { NotificationEventsConsumer } from './jobs/notification-events.consumer'
import { TemplateRenderer } from './core/domain/template-renderer'
import { TemplateValidator } from './core/domain/template-validator'
import { NotificationService, NotificationRouter } from './core/service'
import { RoutingRuleRepository, NotificationRepository } from './persist'
import { WhatsAppChannel, EmailChannel, NOTIFICATION_CHANNELS } from './core/channels'

@Module({
  imports: [
    ConfigModule,
    SqsModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sqsClient = new SQSClient({
          region: config.get('awsRegion'),
          endpoint: config.get('sqsBaseUrl'),
          credentials: {
            accessKeyId: config.get('accessKeyId'),
            secretAccessKey: config.get('secretAccessKey')
          }
        })

        return {
          consumers: [
            {
              name: mapEventToQueue(EventQueues.SESSION_EXPIRED),
              queueUrl: getQueueUrl(mapEventToQueue(EventQueues.SESSION_EXPIRED), config.get('sqsBaseUrl')),
              batchSize: 10,
              waitTimeSeconds: 20,
              authenticationErrorTimeout: 0,
              sqs: sqsClient
            },
            {
              name: mapEventToQueue(EventQueues.RESERVATION_CONFIRMED),
              queueUrl: getQueueUrl(mapEventToQueue(EventQueues.RESERVATION_CONFIRMED), config.get('sqsBaseUrl')),
              batchSize: 10,
              waitTimeSeconds: 20,
              authenticationErrorTimeout: 0,
              sqs: sqsClient
            }
          ],
          producers: [
            {
              name: 'notifications',
              queueUrl: getQueueUrl('notifications' as any, config.get('sqsBaseUrl')),
              sqs: sqsClient
            }
          ]
        }
      }
    })
  ],
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