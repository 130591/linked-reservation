import { Injectable, Logger } from '@nestjs/common'
import { RouterRules, RoutingContext } from '../domain/router-rules'
import { NotificationRecipient } from '../../event'
import { RoutingRuleRepository } from '../../persist/repositories/router-rule.repository'

@Injectable()
export class NotificationRouter {
  private readonly logger = new Logger(NotificationRouter.name)

  constructor(private readonly routingRuleRepository: RoutingRuleRepository) { }

  async route(event: RoutingContext): Promise<NotificationRecipient[]> {
    const rules = await this.routingRuleRepository.findActiveRules(
      event.stayId,
      event.eventType,
      event.recipient.type
    )

    const { decisions, skipped } = new RouterRules(rules).resolve({
      stayId: event.stayId,
      eventType: event.eventType,
      recipient: event.recipient,
      now: new Date()
    })

    for (const error of skipped) {
      this.logger.warn(`[${error.code}] Rule ${error.ruleId}: ${error.cause}`)
    }

    return decisions.map(decision => ({
      id: decision.ruleId.toString(),
      type: event.recipient.type,
      phone: event.recipient.phone,
      email: event.recipient.email,
      name: event.recipient.name
    }))
  }
}
