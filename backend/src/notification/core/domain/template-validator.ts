import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TemplateRenderer } from './template-renderer'

import { DomainEvents } from '@/common/events'

const REQUIRED_TEMPLATES: Array<{ eventType: string; channel: string }> = [
  { eventType: DomainEvents.RESERVATION_CONFIRMED, channel: 'WHATSAPP' },
  { eventType: DomainEvents.RESERVATION_CONFIRMED, channel: 'EMAIL' },
  { eventType: DomainEvents.RESERVATION_CANCELLED, channel: 'WHATSAPP' },
  { eventType: DomainEvents.RESERVATION_CANCELLED, channel: 'EMAIL' },
  { eventType: DomainEvents.SESSION_EXPIRED, channel: 'WHATSAPP' },
  { eventType: DomainEvents.SESSION_EXPIRED, channel: 'EMAIL' },
  { eventType: DomainEvents.SESSION_LINK_GENERATED, channel: 'WHATSAPP' },
  { eventType: DomainEvents.SESSION_LINK_GENERATED, channel: 'EMAIL' },
  { eventType: DomainEvents.RESERVATION_REMINDER, channel: 'WHATSAPP' },
  { eventType: DomainEvents.RESERVATION_REMINDER, channel: 'EMAIL' },
]

@Injectable()
export class TemplateValidator implements OnModuleInit {
  private readonly logger = new Logger(TemplateValidator.name)

  constructor(private readonly renderer: TemplateRenderer) { }

  onModuleInit(): void {
    const missing: string[] = []

    for (const { eventType, channel } of REQUIRED_TEMPLATES) {
      const result = this.renderer.render(eventType, channel, {
        recipient: { name: 'test', type: 'CUSTOMER' }
      })

      if (result.isErr()) {
        missing.push(`${eventType}/${channel.toLowerCase()}.hbs`)
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing notification templates:\n${missing.map(t => `  - ${t}`).join('\n')}`
      )
    }

    this.logger.log(`All ${REQUIRED_TEMPLATES.length} templates validated`)
  }
}