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
  recipient: NotificationRecipient
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

type EvalResult =
  | { type: 'decision'; value: RoutingDecision }
  | { type: 'skip' }
  | { type: 'error'; error: RoutingRuleInvalidError }

export class RouterRules {
  constructor(private readonly rules: RoutingRule[]) {}

  resolve(context: RoutingContext): RoutingResult {
    const results = this.rules.map(rule => this.evaluate(rule, context))

    return {
      decisions: results.filter(isDecision).map(r => r.value),
      skipped:   results.filter(isError).map(r => r.error),
    }
  }

  private evaluate(rule: RoutingRule, context: RoutingContext): EvalResult {
    if (!rule.active) return skip()

    const quiet = this.safeQuietHours(rule, context.now)
    if (quiet.isErr()) return mkError(rule.id, quiet.error)
    if (quiet.value)   return skip()

    const destination = resolveDestination(context.recipient, rule.channel)
    if (!destination) return skip()

    return decision(rule, destination)
  }

  private safeQuietHours(rule: RoutingRule, now: Date): Result<boolean, string> {
    try {
      return ok(isInQuietHours(rule, now))
    } catch {
      return err(`Invalid quiet hours: ${rule.quietHoursStart} - ${rule.quietHoursEnd}`)
    }
  }
}

// --- pure helpers ---

function isInQuietHours(rule: RoutingRule, now: Date): boolean {
  if (!rule.quietHoursStart || !rule.quietHoursEnd) return false

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) throw new Error(`Cannot parse time: ${t}`)
    return h * 60 + m
  }

  const start   = toMinutes(rule.quietHoursStart)
  const end     = toMinutes(rule.quietHoursEnd)
  const current = toMinutes(now.toISOString().slice(11, 16))

  return current >= start && current <= end
}

function resolveDestination(recipient: NotificationRecipient, channel: string): string | null {
  if (channel === NotificationChannel.WHATSAPP) return recipient.phone ?? null
  if (channel === NotificationChannel.EMAIL)    return recipient.email ?? null
  return null
}

// --- EvalResult constructors ---

const skip     = ():                                    EvalResult => ({ type: 'skip' })
const decision = (rule: RoutingRule, destination: string): EvalResult => ({
  type: 'decision',
  value: { ruleId: rule.id, channel: rule.channel, destination },
})
const mkError  = (ruleId: string, message: string):    EvalResult => ({
  type: 'error',
  error: NotificationError.ROUTING_RULE_INVALID(ruleId, message),
})

// --- type guards ---

const isDecision = (r: EvalResult): r is { type: 'decision'; value: RoutingDecision }       => r.type === 'decision'
const isError    = (r: EvalResult): r is { type: 'error'; error: RoutingRuleInvalidError }  => r.type === 'error'