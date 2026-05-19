import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request = require('supertest')
import Stripe = require('stripe')
import { ok, err } from 'neverthrow'

import { WebhookController } from '@/payment/http/controller/webhook'
import { PaymentIntentService } from '@/payment/core/service/payment-intent.service'
import { WebhookEventRepository } from '@/payment/persist/repositories/webhook-event.repository'
import { ConfirmPayment } from '@/reservation/core/service/confirm-payment'
import { ConfigService } from '@/common/config'
import { STRIPE_CLIENT } from '@/common/integrations/stripe'
import { DomainError } from '@/common/exceptions'
import { PaymentIntentStatus } from '@/payment/core/domain'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: any, _key: any, descriptor: any) => descriptor,
}))

const TEST_WEBHOOK_SECRET = 'whsec_test_webhook_secret_for_unit_tests'
const STRIPE_INTENT_ID    = 'pi_test_webhook_abc123'
const LOCAL_INTENT_UUID   = 'local-intent-ext-uuid-001'

const testStripe = new Stripe('sk_test_placeholder', { apiVersion: '2026-04-22.dahlia' })

const makeSucceededEvent = (overrides: Partial<{ id: string }> = {}) => ({
  id:           overrides.id ?? 'evt_test_succeeded_001',
  object:       'event',
  type:         'payment_intent.succeeded',
  created:      Math.floor(Date.now() / 1000),
  api_version:  '2026-04-22.dahlia',
  livemode:     false,
  data:         { object: { id: STRIPE_INTENT_ID, object: 'payment_intent', status: 'succeeded' } },
  pending_webhooks: 1,
  request:      null,
})

const makeFailedEvent = () => ({
  id:           'evt_test_failed_002',
  object:       'event',
  type:         'payment_intent.payment_failed',
  created:      Math.floor(Date.now() / 1000),
  api_version:  '2026-04-22.dahlia',
  livemode:     false,
  data:         { object: { id: STRIPE_INTENT_ID, object: 'payment_intent', status: 'requires_payment_method' } },
  pending_webhooks: 1,
  request:      null,
})

const makeIntentEntity = (overrides: Record<string, any> = {}) => ({
  id:               1,
  externalId:       LOCAL_INTENT_UUID,
  providerIntentId: STRIPE_INTENT_ID,
  status:           PaymentIntentStatus.succeeded,
  confirmedAt:      new Date(),
  customer:         { name: 'João Silva', email: 'joao@example.com', phone: '+5511999990001' },
  lastEventPayload: null,
  ...overrides,
})

function makeSignature(payload: string, timestamp?: number): string {
  return testStripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_WEBHOOK_SECRET,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
  })
}

// ── Shared test module builder ─────────────────────────────────────────────

interface TestDeps {
  intentService:   jest.Mocked<Pick<PaymentIntentService, 'processSucceeded' | 'processFailed'>>
  webhookEventRepo: jest.Mocked<Pick<WebhookEventRepository, 'save'>>
  confirmPayment:  jest.Mocked<Pick<ConfirmPayment, 'handle'>>
}

async function buildApp(deps?: Partial<TestDeps>): Promise<{ app: INestApplication; deps: TestDeps }> {
  const intentService: TestDeps['intentService'] = deps?.intentService ?? {
    processSucceeded: jest.fn().mockResolvedValue(ok(makeIntentEntity())),
    processFailed:    jest.fn().mockResolvedValue(ok(undefined)),
  }
  const webhookEventRepo: TestDeps['webhookEventRepo'] = deps?.webhookEventRepo ?? {
    save: jest.fn().mockResolvedValue(undefined),
  }
  const confirmPayment: TestDeps['confirmPayment'] = deps?.confirmPayment ?? {
    handle: jest.fn().mockResolvedValue(ok({ reservationId: 'res-uuid', bookingReference: 'LR-2605-ABC23' })),
  }

  const module: TestingModule = await Test.createTestingModule({
    controllers: [WebhookController],
    providers: [
      { provide: STRIPE_CLIENT,             useValue: testStripe },
      { provide: PaymentIntentService,      useValue: intentService },
      { provide: WebhookEventRepository,    useValue: webhookEventRepo },
      { provide: ConfirmPayment,            useValue: confirmPayment },
      {
        provide: ConfigService,
        useValue: { get: jest.fn((key: string) => key === 'stripeWebhookSecret' ? TEST_WEBHOOK_SECRET : undefined) },
      },
    ],
  }).compile()

  const app = module.createNestApplication({ rawBody: true })
  await app.init()

  return { app, deps: { intentService, webhookEventRepo, confirmPayment } }
}

// ── Scenario: valid payment_intent.succeeded ───────────────────────────────

describe('Scenario: valid payment_intent.succeeded event', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    ({ app, deps } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a valid Stripe-signed payment_intent.succeeded event', () => {
    it('When the request hits POST /payment/webhook, Then 204, event persisted, processSucceeded called, ConfirmPayment called', async () => {
      const payload   = JSON.stringify(makeSucceededEvent())
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.webhookEventRepo.save).toHaveBeenCalledTimes(1)
      expect(deps.webhookEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt_test_succeeded_001', eventType: 'payment_intent.succeeded' }),
      )

      expect(deps.intentService.processSucceeded).toHaveBeenCalledWith(STRIPE_INTENT_ID, expect.any(Object))

      expect(deps.confirmPayment.handle).toHaveBeenCalledWith({
        paymentIntentId: LOCAL_INTENT_UUID,
        guestName:       'João Silva',
        guestEmail:      'joao@example.com',
        guestPhone:      '+5511999990001',
      })
    })
  })
})

// ── Scenario: invalid signature ────────────────────────────────────────────

describe('Scenario: invalid Stripe webhook signature', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    ({ app, deps } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given an invalid signature header', () => {
    it('When the request hits the endpoint, Then 400 and no rows are persisted', async () => {
      const payload = JSON.stringify(makeSucceededEvent())

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', 't=12345,v1=invalidsignature')
        .set('content-type', 'application/json')
        .send(payload)
        .expect(400)

      expect(deps.webhookEventRepo.save).not.toHaveBeenCalled()
      expect(deps.intentService.processSucceeded).not.toHaveBeenCalled()
    })
  })
})

// ── Scenario: duplicate event (sequential) ────────────────────────────────

describe('Scenario: duplicate webhook event delivered sequentially', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    const dupError: any  = new Error('duplicate key value violates unique constraint')
    dupError.code        = '23505'
    const webhookEventRepo = {
      save: jest.fn()
        .mockResolvedValueOnce(undefined)   // first call succeeds
        .mockRejectedValueOnce(dupError),   // second call throws 23505
    }
    ;({ app, deps } = await buildApp({ webhookEventRepo }))
  })
  afterEach(() => app.close())

  describe('Given the same valid event delivered twice', () => {
    it('When both requests are processed, Then second returns 204 and processSucceeded is called only once', async () => {
      const payload   = JSON.stringify(makeSucceededEvent())
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      // Regenerate signature with same timestamp (same event payload)
      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.webhookEventRepo.save).toHaveBeenCalledTimes(2)
      expect(deps.intentService.processSucceeded).toHaveBeenCalledTimes(1)
      expect(deps.confirmPayment.handle).toHaveBeenCalledTimes(1)
    })
  })
})

// ── Scenario: duplicate event (concurrent) ────────────────────────────────

describe('Scenario: duplicate webhook event delivered concurrently', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    const dupError: any  = new Error('duplicate key value violates unique constraint')
    dupError.code        = '23505'
    let saveCallCount    = 0
    const webhookEventRepo = {
      save: jest.fn().mockImplementation(async () => {
        if (saveCallCount++ === 0) return undefined
        throw dupError
      }),
    }
    ;({ app, deps } = await buildApp({ webhookEventRepo }))
  })
  afterEach(() => app.close())

  describe('Given the same valid event delivered concurrently', () => {
    it('When both run in parallel, Then exactly one processSucceeded and one ConfirmPayment call happen', async () => {
      const payload   = JSON.stringify(makeSucceededEvent({ id: 'evt_concurrent_001' }))
      const signature = makeSignature(payload)

      const [r1, r2] = await Promise.all([
        request(app.getHttpServer())
          .post('/payment/webhook')
          .set('stripe-signature', signature)
          .set('content-type', 'application/json')
          .send(payload),
        request(app.getHttpServer())
          .post('/payment/webhook')
          .set('stripe-signature', signature)
          .set('content-type', 'application/json')
          .send(payload),
      ])

      expect(r1.status).toBe(204)
      expect(r2.status).toBe(204)
      expect(deps.intentService.processSucceeded).toHaveBeenCalledTimes(1)
      expect(deps.confirmPayment.handle).toHaveBeenCalledTimes(1)
    })
  })
})

// ── Scenario: payment_intent.payment_failed ───────────────────────────────

describe('Scenario: payment_intent.payment_failed event', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    ({ app, deps } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a payment_intent.payment_failed event', () => {
    it('When processed, Then 204, event persisted, local intent marked failed, ConfirmPayment NOT called', async () => {
      const payload   = JSON.stringify(makeFailedEvent())
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.webhookEventRepo.save).toHaveBeenCalledTimes(1)
      expect(deps.intentService.processFailed).toHaveBeenCalledWith(STRIPE_INTENT_ID, expect.any(Object))
      expect(deps.intentService.processSucceeded).not.toHaveBeenCalled()
      expect(deps.confirmPayment.handle).not.toHaveBeenCalled()
    })
  })
})

// ── Scenario: unhandled event type ────────────────────────────────────────

describe('Scenario: unhandled Stripe event type', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    ({ app, deps } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a customer.created event (unsupported type)', () => {
    it('When processed, Then 204, event persisted, no service methods called', async () => {
      const payload = JSON.stringify({
        id: 'evt_customer_created_001',
        object: 'event',
        type: 'customer.created',
        created: Math.floor(Date.now() / 1000),
        api_version: '2026-04-22.dahlia',
        livemode: false,
        data: { object: { id: 'cus_test_xxx' } },
        pending_webhooks: 1,
        request: null,
      })
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.webhookEventRepo.save).toHaveBeenCalledTimes(1)
      expect(deps.intentService.processSucceeded).not.toHaveBeenCalled()
      expect(deps.intentService.processFailed).not.toHaveBeenCalled()
      expect(deps.confirmPayment.handle).not.toHaveBeenCalled()
    })
  })
})

// ── Scenario: non-23505 DB error during event save ────────────────────────

describe('Scenario: unexpected DB error during webhook_events save', () => {
  let app: INestApplication

  beforeEach(async () => {
    const dbError: any = new Error('connection timeout')
    dbError.code = '08006'
    const webhookEventRepo = { save: jest.fn().mockRejectedValue(dbError) }
    ;({ app } = await buildApp({ webhookEventRepo }))
  })
  afterEach(() => app.close())

  describe('Given a transient DB error (not 23505) when saving the event', () => {
    it('When the request hits the endpoint, Then the error propagates (500)', async () => {
      const payload   = JSON.stringify(makeSucceededEvent({ id: 'evt_db_error_001' }))
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(500)
    })
  })
})

// ── Scenario: processSucceeded returns an error ───────────────────────────

describe('Scenario: processSucceeded returns PAYMENT_INTENT_NOT_FOUND', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    const intentService = {
      processSucceeded: jest.fn().mockResolvedValue(err(DomainError.PAYMENT_INTENT_NOT_FOUND())),
      processFailed:    jest.fn().mockResolvedValue(ok(undefined)),
    }
    ;({ app, deps } = await buildApp({ intentService }))
  })
  afterEach(() => app.close())

  describe('Given processSucceeded fails (intent not found locally)', () => {
    it('When processed, Then 204 is returned and ConfirmPayment is NOT called', async () => {
      const payload   = JSON.stringify(makeSucceededEvent({ id: 'evt_not_found_001' }))
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.intentService.processSucceeded).toHaveBeenCalled()
      expect(deps.confirmPayment.handle).not.toHaveBeenCalled()
    })
  })
})

// ── Scenario: processFailed returns an error ──────────────────────────────

describe('Scenario: processFailed returns PAYMENT_INTENT_NOT_FOUND', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    const intentService = {
      processSucceeded: jest.fn().mockResolvedValue(ok(makeIntentEntity())),
      processFailed:    jest.fn().mockResolvedValue(err(DomainError.PAYMENT_INTENT_NOT_FOUND())),
    }
    ;({ app, deps } = await buildApp({ intentService }))
  })
  afterEach(() => app.close())

  describe('Given processFailed fails (intent not found locally)', () => {
    it('When payment_failed event processed, Then 204 is returned', async () => {
      const payload   = JSON.stringify(makeFailedEvent())
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.intentService.processFailed).toHaveBeenCalled()
    })
  })
})

// ── Scenario: SESSION_EXPIRED on succeeded event ───────────────────────────

describe('Scenario: SESSION_EXPIRED when processing payment_intent.succeeded', () => {
  let app: INestApplication
  let deps: TestDeps

  beforeEach(async () => {
    const confirmPayment = {
      handle: jest.fn().mockResolvedValue(err(DomainError.SESSION_EXPIRED())),
    }
    ;({ app, deps } = await buildApp({ confirmPayment }))
  })
  afterEach(() => app.close())

  describe("Given a HOLD whose session has expired before the webhook arrives", () => {
    it('When processed, Then local intent is still succeeded, response is 204 (polling fallback surfaces error to guest)', async () => {
      const payload   = JSON.stringify(makeSucceededEvent({ id: 'evt_expired_session_001' }))
      const signature = makeSignature(payload)

      await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', signature)
        .set('content-type', 'application/json')
        .send(payload)
        .expect(204)

      expect(deps.intentService.processSucceeded).toHaveBeenCalledWith(STRIPE_INTENT_ID, expect.any(Object))
      expect(deps.confirmPayment.handle).toHaveBeenCalled()
      // 204 despite SESSION_EXPIRED — Stripe must not retry on application-level failures
    })
  })
})
