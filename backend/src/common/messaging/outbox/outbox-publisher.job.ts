import { Injectable, Logger } from '@nestjs/common'
import { Transactional } from 'typeorm-transactional'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { Cron } from '@nestjs/schedule'
import { OutboxRepository } from './outbox.repository'
import { OutboxEventEntity } from './outbox-event.entity'
import { ConfigService } from '@/common/config/service/config.service'

@Injectable()
export class OutboxPublisherJob {
  private readonly logger = new Logger(OutboxPublisherJob.name)
  private readonly client: SQSClient
  private readonly baseUrl: string

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly config: ConfigService
  ) {
    this.client = new SQSClient({ region: this.config.get('awsRegion') })
    this.baseUrl = this.config.get('sqsBaseUrl')
  }

  @Cron('*/10 * * * * *') // each 10 seconds
  @Transactional()
  async run(): Promise<void> {
    const events = await this.outboxRepo.findUnpublished(50)
    if (events.length === 0) return

    const results = await Promise.allSettled(
      events.map(event => this.publishToSqs(event))
    )

    // Mark as published only those that were successful
    const publishedIds = events
      .filter((_, i) => results[i].status === 'fulfilled')
      .map(e => e.id)

    if (publishedIds.length > 0) {
      await this.outboxRepo.markPublished(publishedIds)
    }

    // Log failures without crashing the job
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to publish outbox event ${events[i].id} to ${events[i].queue}`,
          result.reason
        )
      }
    })
  }

  private async publishToSqs(event: OutboxEventEntity): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl: `${this.baseUrl}/${event.queue}`,
      MessageBody: JSON.stringify(event.payload),
      MessageDeduplicationId: event.id, // idempotency on the SQS FIFO
      MessageGroupId: event.queue,
      DelaySeconds: event.delaySeconds
    }))
  }
}