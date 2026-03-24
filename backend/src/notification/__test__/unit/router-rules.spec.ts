import { RouterRules, RoutingRule } from '@/notification/core/domain/router-rules'
import { RecipientType, NotificationChannel } from '@/notification/event'

const makeRule = (overrides: Partial<RoutingRule> = {}): RoutingRule => ({
  id: 'rule-1',
  stayId: 'hotel-1',
  eventType: 'reservation.confirmed',
  channel: 'WHATSAPP',
  recipientType: 'STAFF',
  active: true,
  quietHoursStart: '',
  quietHoursEnd: '',
  ...overrides
})

const makeRecipient = (overrides = {}) => ({
  id: 'recipient-1',
  type: RecipientType.STAFF,
  phone: '5511999990000',
  email: 'staff@hotel.com',
  name: 'Maria',
  ...overrides
})


describe('Scenario: Routing notification rules to channels', () => {

  describe('Given a reservation is confirmed with both WhatsApp and Email rules active', () => {
    const rules = [
      makeRule({ id: 'rule-whatsapp', channel: NotificationChannel.WHATSAPP }),
      makeRule({ id: 'rule-email', channel: NotificationChannel.EMAIL }),
    ]

    it('When the system routes the message, then it should generate decisions for both channels', () => {
      const router = new RouterRules(rules)

      const { decisions, skipped } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T14:00:00Z') // 2pm — outside quiet hours
      })

      expect(decisions).toHaveLength(2)
      expect(decisions[0]).toEqual({
        ruleId: 'rule-whatsapp',
        channel: 'WHATSAPP',
        destination: '5511999990000'
      })
      expect(decisions[1]).toEqual({
        ruleId: 'rule-email',
        channel: 'EMAIL',
        destination: 'staff@hotel.com'
      })
      expect(skipped).toHaveLength(0)
    })
  })

  describe('Given an inactive rule exists', () => {
    const rules = [
      makeRule({ id: 'rule-inactive', active: false, channel: NotificationChannel.EMAIL }),
      makeRule({ id: 'rule-active', channel: NotificationChannel.WHATSAPP }),
    ]

    it('When the system resolves, then only the active rule should produce a decision', () => {
      const router = new RouterRules(rules)

      const { decisions } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T14:00:00Z')
      })

      expect(decisions).toHaveLength(1)
      expect(decisions[0].ruleId).toBe('rule-active')
    })
  })

  describe('Given a recipient has only email and no phone', () => {
    const rules = [
      makeRule({ id: 'rule-whatsapp', channel: NotificationChannel.WHATSAPP }),
      makeRule({ id: 'rule-email', channel: NotificationChannel.EMAIL })
    ]

    it('When the system routes, then only Email should produce a decision (WhatsApp has no destination)', () => {
      const router = new RouterRules(rules)

      const { decisions } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient({ phone: undefined }),
        now: new Date('2030-03-15T14:00:00Z')
      })

      expect(decisions).toHaveLength(1)
      expect(decisions[0].channel).toBe('EMAIL')
    })
  })
})


describe('Scenario: Quiet hours suppress notifications', () => {

  describe('Given quiet hours are configured from 22:00 to 08:00', () => {
    const rules = [
      makeRule({
        id: 'rule-quiet',
        channel: NotificationChannel.WHATSAPP,
        quietHoursStart: '22:00',
        quietHoursEnd: '23:59'
      })
    ]

    it('When a notification is sent at 23:00, then it should be suppressed', () => {
      const router = new RouterRules(rules)

      const { decisions } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T23:00:00Z') // 11pm — inside quiet hours
      })

      expect(decisions).toHaveLength(0)
    })

    it('But when a notification is sent at 14:00, then it should be delivered', () => {
      const router = new RouterRules(rules)

      const { decisions } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T14:00:00Z') // 2pm — outside quiet hours
      })

      expect(decisions).toHaveLength(1)
      expect(decisions[0].ruleId).toBe('rule-quiet')
    })
  })

  describe('Given quiet hours have no values configured', () => {
    const rules = [
      makeRule({ quietHoursStart: '', quietHoursEnd: '' })
    ]

    it('Then the notification should always be delivered regardless of time', () => {
      const router = new RouterRules(rules)

      const { decisions } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T23:30:00Z')
      })

      expect(decisions).toHaveLength(1)
    })
  })

  describe('Given a rule has invalid quiet hours format', () => {
    const rules = [
      makeRule({
        id: 'rule-broken',
        quietHoursStart: 'INVALID',
        quietHoursEnd: 'ALSO_INVALID'
      })
    ]

    it('Then the rule should be reported as skipped with a ROUTING_RULE_INVALID error', () => {
      const router = new RouterRules(rules)

      const { decisions, skipped } = router.resolve({
        stayId: 'hotel-1',
        eventType: 'reservation.confirmed',
        recipient: makeRecipient(),
        now: new Date('2030-03-15T14:00:00Z')
      })

      expect(decisions).toHaveLength(0)
      expect(skipped).toHaveLength(1)
      expect(skipped[0].code).toBe('ROUTING_RULE_INVALID')
      expect(skipped[0].ruleId).toBe('rule-broken')
    })
  })
})
