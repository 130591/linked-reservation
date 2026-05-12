import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'

import { PaymentIntentEntity } from '@/payment/persist/entities/payment-intent.entity'
import { WebhookEventEntity } from '@/payment/persist/entities/webhook-event.entity'
import { PaymentIntentStatus } from '@/payment/core/domain'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { WebhookEventRepository } from '@/payment/persist/repositories/webhook-event.repository'

import { InitialSchema1775788347017 } from '@/common/database/migrations/1775788347017-InitialSchema'
import { NotificationRecipientIdVarchar1775900000000 } from '@/common/database/migrations/1775900000000-NotificationRecipientIdVarchar'
import { NotificationIdempotencyKey1775950000000 } from '@/common/database/migrations/1775950000000-NotificationIdempotencyKey'
import { CreatePaymentSchema1775960000000 } from '@/common/database/migrations/1775960000000-CreatePaymentSchema'
import { AddBookingReferenceAndGuestDetails1775960000001 } from '@/common/database/migrations/1775960000001-AddBookingReferenceAndGuestDetails'

const CONTAINER_STARTUP_TIMEOUT_MS = 120_000

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

describe('Scenario: PaymentIntentStatus enum', () => {
  it('When the enum is inspected, Then it exposes the five expected values', () => {
    expect(PaymentIntentStatus.pending).toBe('pending')
    expect(PaymentIntentStatus.processing).toBe('processing')
    expect(PaymentIntentStatus.succeeded).toBe('succeeded')
    expect(PaymentIntentStatus.failed).toBe('failed')
    expect(PaymentIntentStatus.cancelled).toBe('cancelled')
  })
})

describe('Scenario: Payment entity column declarations', () => {
  it('When PaymentIntentEntity is constructed, Then all columns are assignable', () => {
    const entity = new PaymentIntentEntity({
      reservationId: '11111111-1111-1111-1111-111111111111',
      providerIntentId: 'pi_test_abc',
      amountCents: 9900,
      currency: 'BRL',
      status: PaymentIntentStatus.pending,
      lastEventPayload: null,
      confirmedAt: null,
    })
    expect(entity.reservationId).toBe('11111111-1111-1111-1111-111111111111')
    expect(entity.providerIntentId).toBe('pi_test_abc')
    expect(entity.amountCents).toBe(9900)
    expect(entity.status).toBe(PaymentIntentStatus.pending)
  })

  it('When WebhookEventEntity is constructed, Then all columns are assignable', () => {
    const entity = new WebhookEventEntity({
      eventId: 'evt_test_abc',
      eventType: 'payment_intent.succeeded',
      payload: { id: 'evt_test_abc' },
    })
    expect(entity.eventId).toBe('evt_test_abc')
    expect(entity.eventType).toBe('payment_intent.succeeded')
  })
})

describe('Scenario: Payment repository integration tests', () => {
  let container: StartedPostgreSqlContainer
  let dataSource: DataSource
  let intentRepo: PaymentIntentRepository
  let webhookRepo: WebhookEventRepository

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

    intentRepo  = new PaymentIntentRepository(dataSource)
    webhookRepo = new WebhookEventRepository(dataSource)
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

  describe('Given an empty payment schema', () => {
    it('When a PaymentIntentEntity is saved, Then findOneById returns the same entity', async () => {
      const intent = new PaymentIntentEntity({
        reservationId: '11111111-1111-1111-1111-111111111111',
        providerIntentId: 'pi_find_test',
        amountCents: 9900,
        currency: 'BRL',
        status: PaymentIntentStatus.pending,
        lastEventPayload: null,
        confirmedAt: null,
      })
      const saved = await intentRepo.save(intent)

      const found = await intentRepo.findOneById(saved.externalId)
      expect(found).not.toBeNull()
      expect(found!.providerIntentId).toBe('pi_find_test')
    })

    it('When two intents share the same providerIntentId, Then the second save raises 23505', async () => {
      const save = () =>
        intentRepo.save(new PaymentIntentEntity({
          reservationId: '11111111-1111-1111-1111-111111111111',
          providerIntentId: 'pi_dup_test',
          amountCents: 100,
          currency: 'BRL',
          status: PaymentIntentStatus.pending,
          lastEventPayload: null,
          confirmedAt: null,
        }))

      await save()
      await expect(save()).rejects.toMatchObject({ code: '23505' })
    })

    it('When markSucceeded is called on a pending intent, Then status is succeeded, confirmedAt is set, and payload matches', async () => {
      const intent = await intentRepo.save(new PaymentIntentEntity({
        reservationId: '22222222-2222-2222-2222-222222222222',
        providerIntentId: 'pi_succeed_test',
        amountCents: 5000,
        currency: 'BRL',
        status: PaymentIntentStatus.pending,
        lastEventPayload: null,
        confirmedAt: null,
      }))
      const eventPayload = { id: 'evt_ok', type: 'payment_intent.succeeded' }

      await intentRepo.markSucceeded(intent.id, eventPayload)

      const updated = await intentRepo.findOneById(intent.externalId)
      expect(updated!.status).toBe(PaymentIntentStatus.succeeded)
      expect(updated!.confirmedAt).not.toBeNull()
      expect(updated!.lastEventPayload).toMatchObject(eventPayload)
    })

    it('When two webhook events share the same eventId, Then the second save raises 23505', async () => {
      const save = () =>
        webhookRepo.save(new WebhookEventEntity({
          eventId: 'evt_dup_test',
          eventType: 'payment_intent.succeeded',
          payload: {},
        }))

      await save()
      await expect(save()).rejects.toMatchObject({ code: '23505' })
    })

    it('When findByEventId is called for a missing id, Then the result is null', async () => {
      const result = await webhookRepo.findByEventId('evt_nonexistent')
      expect(result).toBeNull()
    })
  })
})
