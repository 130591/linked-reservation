import { Injectable } from '@nestjs/common'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { EventBus, PublishOptions } from './event-bus.interface'
import { ConfigService } from '@/common/config'

@Injectable()
export class SqsEventBus implements EventBus {
  private readonly client: SQSClient
  private readonly baseUrl: string

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({
      region: this.config.get('awsRegion')
    })
    this.baseUrl = this.config.get('sqsBaseUrl')
  }

  async publish<T>(
    queue: string,
    payload: T,
    options?: PublishOptions
  ): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl: `${this.baseUrl}/${queue}`,
      MessageBody: JSON.stringify(payload),
      DelaySeconds: options?.delaySeconds ?? 0
    }))
  }
}