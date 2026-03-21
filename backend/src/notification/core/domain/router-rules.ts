import { NotificationChannel, NotificationRecipient } from '../../event'
import { NotificationError, RoutingRuleInvalidError } from './notification-error'

export interface RoutingRule {
  id: string
  hotelId: string
  eventType: string
  channel: string
  recipientType: string
  active: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export interface RoutingContext {
  hotelId: string
  eventType: string
  recipient: NotificationRecipient,
  now: Date
}

export interface RoutingDecision {
  ruleId: string
  channel: string
  destination: string
}

export interface RoutingResult {
  decisions: RoutingDecision[]
  skipped: RoutingRuleInvalidError[]
}

export class RouterRules {
  constructor(
    private readonly rules: RoutingRule[]
  ) { }

  resolve(context: RoutingContext): RoutingResult {
    const decisions: RoutingDecision[] = []
    const skipped: RoutingRuleInvalidError[] = []

    for (const rule of this.rules) {
      const result = this.evaluate(rule, context)

      if (result.type === 'decision') decisions.push(result.value)
      if (result.type === 'error') skipped.push(result.error)
      // type === 'skip' → silently ignored (inactive, quiet hours, no destination)
    }

    return { decisions, skipped }
  }

  private evaluate(
    rule: RoutingRule,
    context: RoutingContext
  ): EvalResult {
    if (!rule.active) return { type: 'skip' }

    try {
      if (this.isInQuietHours(rule, context.now)) return { type: 'skip' }
    } catch {
      return {
        type: 'error',
        error: NotificationError.ROUTING_RULE_INVALID(
          rule.id,
          `Invalid quiet hours format: '${rule.quietHoursStart}' - '${rule.quietHoursEnd}'`
        )
      }
    }

    const destination = this.resolveDestination(context.recipient, rule.channel)
    if (!destination) return { type: 'skip' }

    return {
      type: 'decision',
      value: {
        ruleId: rule.id,
        channel: rule.channel,
        destination
      }
    }
  }

  private isInQuietHours(rule: RoutingRule, now: Date): boolean {
    if (!rule.quietHoursStart || !rule.quietHoursEnd) return false

    const start = this.parseTime(rule.quietHoursStart)
    const end = this.parseTime(rule.quietHoursEnd)
    const time = this.parseTime(now.toISOString().slice(11, 19))

    return time >= start && time <= end
  }

  private parseTime(time: string): number {
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) throw new Error(`Cannot parse time: ${time}`)
    return this.toMinutes(h, m)
  }

  private toMinutes(hours: number, minutes: number): number {
    return hours * 60 + minutes
  }

  private resolveDestination(
    recipient: NotificationRecipient,
    channel: string
  ): string | null {
    if (channel === NotificationChannel.WHATSAPP) return recipient.phone ?? null
    if (channel === NotificationChannel.EMAIL) return recipient.email ?? null
    return null
  }
}

type EvalResult =
  | { type: 'decision'; value: RoutingDecision }
  | { type: 'skip' }
  | { type: 'error'; error: RoutingRuleInvalidError }