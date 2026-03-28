import { Inject, Injectable, Logger } from '@nestjs/common'
import { Transactional } from 'typeorm-transactional'
import { NotificationRepository } from '../../persist/repositories/notification.repository'
import { NotificationEvent, NotificationRecipient } from '../../event'
import { TemplateRenderer } from '../domain/template-renderer'
import { NotificationChannel as ChannelType, NotificationEntity } from '../../persist/entities/notification'
import { NOTIFICATION_CHANNELS, NotificationChannel as IChannel } from '../channels'
import { NotificationError } from '../domain/notification-error'


@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly notificationRepo: NotificationRepository,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channelImpls: IChannel[]
  ) { }

  @Transactional()
  async dispatch(event: NotificationEvent): Promise<void> {
    await Promise.allSettled(
      event.recipients.map(recipient =>
        this.dispatchToRecipient(event, recipient)
      )
    )
  }

  private async dispatchToRecipient(
    event: NotificationEvent,
    recipient: NotificationRecipient
  ): Promise<void> {
    const channel = this.resolveChannel(recipient)
    const destination = this.resolveDestination(recipient, channel)

    if (!destination) {
      this.logger.warn(
        `Recipient ${recipient.id} has no destination for channel ${channel}`
      )
      return
    }

    const existing = await this.notificationRepo.findOne({
      where: {
        eventType: event.type,
        recipientId: recipient.id,
        channel
      }
    })
    if (existing) return

    const renderResult = this.templateRenderer.render(
      event.type,
      channel,
      {
        ...event.payload,
        recipient: {
          name: recipient.name,
          type: recipient.type
        }
      }
    )

    if (renderResult.isErr()) {
      this.logger.error(
        `[${renderResult.error.code}] ${renderResult.error.message}`
      )
      return
    }

    const body = renderResult.value
    const notification = await this.notificationRepo.save(
      new NotificationEntity({
        recipientId: recipient.id,
        recipientType: recipient.type as any,
        channel,
        destination,
        stayId: event.payload.stayId as string,
        eventType: event.type,
        templateId: `${event.type}.${channel.toLowerCase()}`,
        payload: event.payload,
        renderedBody: body,
        status: 'PENDING'
      })
    )

    // ── Channel Send (Result) ──
    const channelImpl = this.channelImpls.find(c => c.supports(channel))
    if (!channelImpl) {
      const error = NotificationError.NO_CHANNEL_IMPLEMENTATION(channel)
      this.logger.error(`[${error.code}] ${error.message}`)

      await this.notificationRepo.update(notification.id, {
        status: 'FAILED',
        failedAt: new Date(),
        error: error.message
      })
      return
    }

    const sendResult = await channelImpl.send(destination, body, event.payload.stayId as string)

    if (sendResult.isOk()) {
      await this.notificationRepo.update(notification.id, {
        status: 'SENT',
        sentAt: new Date()
      })
      return
    }
    const sendError = sendResult.error

    this.logger.error(
      `[${sendError.code}] ${sendError.message}`
    )

    await this.notificationRepo.update(notification.id, {
      status: 'FAILED',
      failedAt: new Date(),
      error: `[${sendError.code}] ${sendError.message}`
    })

    // retryable errors could be requeued here in the future
    // if (sendError.retryable) { await this.retryQueue.add(...) }
  }

  private resolveChannel(recipient: NotificationRecipient): ChannelType {
    return recipient.phone ? 'WHATSAPP' : 'EMAIL'
  }

  private resolveDestination(
    recipient: NotificationRecipient,
    channel: ChannelType
  ): string | null {
    if (channel === 'WHATSAPP') return recipient.phone ?? null
    if (channel === 'EMAIL') return recipient.email ?? null
    return null
  }
}