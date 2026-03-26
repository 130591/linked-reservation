import { NotificationChannel, NotificationRecipient } from '../../event'
import { NotificationError, RoutingRuleInvalidError } from './notification-error'
import { err, ok, Result } from 'neverthrow'

export interface RoutingRule {
  id: string
  stayId: string
  eventType: string
  channel: string
  recipientType: string
  active: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export interface RoutingContext {
  stayId: string
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
    const results = this.rules.map(rule => 
      this.evaluate(rule, context))

      return {
        decisions: results
          .filter(isDecision)
          .map(r => r.value),
        skipped: results
          .filter(isError)
          .map(r => r.error)
      }
  }

  private evaluate(rule: RoutingRule, context: RoutingContext): EvalResult {
    if (!rule.active) return skip()
    const quiet = this.safeQuietHours(rule, context)
    if (quiet.isErr()) return error(rule.id, quiet.error)
    if (quiet.value) return skip()
    const destination = this.resolveDestination(context.recipient, rule.channel)
    if (!destination) return skip()
    return decision(rule, destination)
}

  private safeQuietHours(
    rule: RoutingRule,
    context: RoutingContext
  ): Result<boolean, string> {
    try {
      return ok(this.isInQuietHours(rule, context.now))
    } catch (e) {
      return err(`Invalid quiet hours: 
        ${rule.quietHoursStart} - 
        ${rule.quietHoursEnd}`
      )
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

  function isDecision(result: EvalResult): result is { type: 'decision', value: RoutingDecision } 
  {
    return result.type === 'decision'
  }

  function isError(result: EvalResult): result is 
  { type: 'error'; error: RoutingRuleInvalidError } 
  {
    return result.type === 'error'
  }


  const skip = (): EvalResult => ({ type: 'skip' })

  const decision = (rule: RoutingRule, destination: string): EvalResult => ({
    type: 'decision',
    value: {
      ruleId: rule.id,
      channel: rule.channel,
      destination
    }
  })

  const error = (ruleId: string, message: string): EvalResult => ({
    type: 'error',
    error: NotificationError.ROUTING_RULE_INVALID(ruleId, message)
  })

type EvalResult =
  | { type: 'decision'; value: RoutingDecision }
  | { type: 'skip' }
  | { type: 'error'; error: RoutingRuleInvalidError }