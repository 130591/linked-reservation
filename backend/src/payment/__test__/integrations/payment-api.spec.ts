import 'reflect-metadata'
import { Test, TestingModule } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'

import { PaymentAPI } from '@/payment/external-api/payment-api'
import { PaymentIntentService } from '@/payment/core/service/payment-intent.service'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { PaymentIntentEntity } from '@/payment/persist/entities/payment-intent.entity'
import { WebhookEventEntity } from '@/payment/persist/entities/webhook-event.entity'
import { PaymentIntentStatus, StripeStatus, StripeError } from '@/payment/core/domain'
import { STRIPE_CLIENT } from '@/common/integrations/stripe'

import { InitialSchema1775788347017 } from '@/common/database/migrations/1775788347017-InitialSchema'
import { NotificationRecipientIdVarchar1775900000000 } from '@/common/database/migrations/1775900000000-NotificationRecipientIdVarchar'
import { NotificationIdempotencyKey1775950000000 } from '@/common/database/migrations/1775950000000-NotificationIdempotencyKey'
import { CreatePaymentSchema1775960000000 } from '@/common/database/migrations/1775960000000-CreatePaymentSchema'
import { AddBookingReferenceAndGuestDetails1775960000001 } from '@/common/database/migrations/1775960000001-AddBookingReferenceAndGuestDetails'

const CONTAINER_STARTUP_TIMEOUT_MS = 120_000

// ── Unit tests: mappers (no DB, no Docker) ─────────────────────────────────

describe('Scenario: Stripe error mapper', () => {
  describe('Given a StripeAuthenticationError', () => {
    it('When mapped, Then result is PAYMENT_PROVIDER_UNAVAILABLE', () => {
      const error = Object.assign(new Error('auth'), { type: 'authentication_error' })
      expect(StripeError.exception(error).code).toBe('PAYMENT_PROVIDER_UNAVAILABLE')
    })
  })

  describe('Given a StripeCardError', () => {
    it('When mapped, Then result is PAYMENT_DECLINED', () => {
      const error = Object.assign(new Error('declined'), { type: 'card_error' })
      expect(StripeError.exception(error).code).toBe('PAYMENT_DECLINED')
    })
  })

  describe('Given a StripeInvalidRequestError or unknown Stripe error', () => {
    it('When mapped, Then result is PAYMENT_PROVIDER_UNAVAILABLE', () => {
      const error = Object.assign(new Error('bad request'), { type: 'invalid_request_error' })
      expect(StripeError.exception(error).code).toBe('PAYMENT_PROVIDER_UNAVAILABLE')
    })
  })

  describe('Given a non-Stripe error', () => {
    it('When mapped, Then result is PAYMENT_PROVIDER_UNAVAILABLE', () => {
      expect(StripeError.exception(new Error('network timeout')).code).toBe('PAYMENT_PROVIDER_UNAVAILABLE')
    })
  })
})

describe('Scenario: Stripe status mapper', () => {
  it.each([
    ['requires_payment_method', PaymentIntentStatus.pending],
    ['requires_confirmation',   PaymentIntentStatus.pending],
    ['requires_action',         PaymentIntentStatus.processing],
    ['processing',              PaymentIntentStatus.processing],
    ['requires_capture',        PaymentIntentStatus.processing],
    ['succeeded',               PaymentIntentStatus.succeeded],
    ['canceled',                PaymentIntentStatus.cancelled],
    ['unknown_status',          PaymentIntentStatus.pending],
  ])('When Stripe status is %s, Then local status is %s', (stripeStatus, expected) => {
    expect(StripeStatus.translate(stripeStatus as any)).toBe(expected)
  })
})

// ── Integration tests: PaymentAPI with real Postgres + stubbed Stripe ──────

const newDataSource = (container: StartedPostgreSqlContainer): DataSource =>
  new DataSource({
    type: 'postgres',
    host: container.getHost(),
    port: container.getMappedPort(5432),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
    entities: [PaymentIntentEntity, WebhookEventEntity],
    synchronize: false,
    migrations: [
      InitialSchema1775788347017,
      NotificationRecipientIdVarchar1775900000000,
      NotificationIdempotencyKey1775950000000,
      CreatePaymentSchema1775960000000,
      AddBookingReferenceAndGuestDetails1775960000001,
    ],
  })

describe('Scenario: PaymentAPI integration tests', () => {
  let container: StartedPostgreSqlContainer
  let dataSource: DataSource
  let paymentApi: PaymentAPI
  let intentRepo: PaymentIntentRepository
  let mockStripe: jest.Mocked<{ paymentIntents: { create: jest.Mock; retrieve: jest.Mock } }>

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
  }, CONTAINER_STARTUP_TIMEOUT_MS)

  afterAll(async () => {
    await container?.stop()
  })

  beforeEach(async () => {
    dataSource = newDataSource(container)
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'each' })

    intentRepo = new PaymentIntentRepository(dataSource)

    mockStripe = {
      paymentIntents: {
        create:   jest.fn(),
        retrieve: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentIntentService,
        PaymentAPI,
        { provide: PaymentIntentRepository, useValue: intentRepo },
        { provide: STRIPE_CLIENT, useValue: mockStripe },
      ],
    }).compile()

    paymentApi = module.get(PaymentAPI)
  })

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(`DROP SCHEMA IF EXISTS payment CASCADE`)
      await dataSource.query(`DROP SCHEMA IF EXISTS identity CASCADE`)
      await dataSource.query(`DROP SCHEMA IF EXISTS reservation CASCADE`)
      await dataSource.query(`DROP SCHEMA IF EXISTS notification CASCADE`)
      await dataSource.query(`DROP SCHEMA IF EXISTS common CASCADE`)
      await dataSource.query(`DROP TABLE IF EXISTS public.migrations`)
      await dataSource.destroy()
    }
  })

  const RESERVATION_ID = '11111111-1111-1111-1111-111111111111'

  describe('Given a reservation, When createIntent succeeds', () => {
    it('Then a PaymentIntentEntity is persisted and the result contains the clientSecret', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id:            'pi_test_abc',
        status:        'requires_payment_method',
        client_secret: 'pi_test_abc_secret_xyz',
      })

      const result = await paymentApi.createIntent({
        reservationId: RESERVATION_ID,
        amountCents:   9900,
        description:   'Quarto Standard',
        guest: { name: 'Guest', email: 'guest@example.com', phone: '+5511999990001' },
      })

      expect(result.isOk()).toBe(true)
      const { intentId, clientSecret } = result._unsafeUnwrap()
      expect(clientSecret).toBe('pi_test_abc_secret_xyz')

      const persisted = await intentRepo.findOneById(intentId)
      expect(persisted).not.toBeNull()
      expect(persisted!.providerIntentId).toBe('pi_test_abc')
      expect(persisted!.reservationId).toBe(RESERVATION_ID)
    })
  })

  describe('Given Stripe returns an authentication error, When createIntent is called', () => {
    it('Then result is Err(PAYMENT_PROVIDER_UNAVAILABLE) and no row is persisted', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        Object.assign(new Error('auth'), { type: 'authentication_error' }),
      )

      const result = await paymentApi.createIntent({
        reservationId: RESERVATION_ID,
        amountCents:   9900,
        description:   'Quarto Standard',
        guest: { name: 'Guest', email: 'guest@example.com', phone: '+5511999990001' },
      })

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PAYMENT_PROVIDER_UNAVAILABLE')

      const rows = await dataSource.query(`SELECT id FROM payment.payment_intents`)
      expect(rows).toHaveLength(0)
    })
  })

  describe('Given a stored intent in pending, When getStatus is called', () => {
    it('Then it returns the local status without calling Stripe', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id:            'pi_get_status',
        status:        'requires_payment_method',
        client_secret: 'secret',
      })
      const { intentId } = (await paymentApi.createIntent({
        reservationId: RESERVATION_ID,
        amountCents:   100,
        description:   'Test',
        guest: { name: 'Test Guest', email: 'a@b.com', phone: '+5511900000001' },
      }))._unsafeUnwrap()

      const result = await paymentApi.getStatus(intentId)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().status).toBe(PaymentIntentStatus.pending)
      expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled()
    })
  })

  describe('Given a pending intent and Stripe reports succeeded, When refreshFromProvider is called', () => {
    it('Then the local row is updated to succeeded and confirmedAt is set', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id:            'pi_refresh_test',
        status:        'requires_payment_method',
        client_secret: 'secret',
      })
      const { intentId } = (await paymentApi.createIntent({
        reservationId: RESERVATION_ID,
        amountCents:   100,
        description:   'Test',
        guest: { name: 'Test Guest', email: 'a@b.com', phone: '+5511900000001' },
      }))._unsafeUnwrap()

      mockStripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_refresh_test', status: 'succeeded' })

      const result = await paymentApi.refreshFromProvider(intentId)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().status).toBe(PaymentIntentStatus.succeeded)

      const updated = await intentRepo.findOneById(intentId)
      expect(updated!.status).toBe(PaymentIntentStatus.succeeded)
      expect(updated!.confirmedAt).not.toBeNull()
    })
  })

  describe('Given an intent already succeeded, When refreshFromProvider is called', () => {
    it('Then the result reports succeeded and Stripe is NOT called (idempotent)', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({
        id:            'pi_already_done',
        status:        'succeeded',
        client_secret: 'secret',
      })
      const { intentId } = (await paymentApi.createIntent({
        reservationId: RESERVATION_ID,
        amountCents:   100,
        description:   'Test',
        guest: { name: 'Test Guest', email: 'a@b.com', phone: '+5511900000001' },
      }))._unsafeUnwrap()

      mockStripe.paymentIntents.retrieve.mockClear()
      const result = await paymentApi.refreshFromProvider(intentId)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().status).toBe(PaymentIntentStatus.succeeded)
      expect(mockStripe.paymentIntents.retrieve).not.toHaveBeenCalled()
    })
  })
})
