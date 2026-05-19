import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { ReservationEntity } from '@/reservation/persist/entities/reservation'

import { InitialSchema1775788347017 }
  from '@/common/database/migrations/1775788347017-InitialSchema'
import { NotificationRecipientIdVarchar1775900000000 }
  from '@/common/database/migrations/1775900000000-NotificationRecipientIdVarchar'
import { NotificationIdempotencyKey1775950000000 }
  from '@/common/database/migrations/1775950000000-NotificationIdempotencyKey'
import { CreatePaymentSchema1775960000000 }
  from '@/common/database/migrations/1775960000000-CreatePaymentSchema'
import { AddBookingReferenceAndGuestDetails1775960000001 }
  from '@/common/database/migrations/1775960000001-AddBookingReferenceAndGuestDetails'

const CONTAINER_STARTUP_TIMEOUT_MS = 120_000

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: 'YES' | 'NO'
  character_maximum_length: number | null
}

const newDataSource = (container: StartedPostgreSqlContainer): DataSource =>
  new DataSource({
    type: 'postgres',
    host: container.getHost(),
    port: container.getMappedPort(5432),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
    entities: [],
    synchronize: false,
    migrationsTableName: 'migrations',
    migrations: [
      InitialSchema1775788347017,
      NotificationRecipientIdVarchar1775900000000,
      NotificationIdempotencyKey1775950000000,
      CreatePaymentSchema1775960000000,
      AddBookingReferenceAndGuestDetails1775960000001,
    ],
  })

describe('Scenario: Booking flow migrations create payment schema and reservation columns', () => {
  let container: StartedPostgreSqlContainer
  let dataSource: DataSource

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
  }, CONTAINER_STARTUP_TIMEOUT_MS)

  afterAll(async () => {
    await container?.stop()
  })

  beforeEach(async () => {
    dataSource = newDataSource(container)
    await dataSource.initialize()
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

  describe('Given a freshly migrated database', () => {
    beforeEach(async () => {
      await dataSource.runMigrations({ transaction: 'each' })
    })

    it('When the payment schema is inspected, Then it exists with both tables', async () => {
      const schemas = await dataSource.query<{ schema_name: string }[]>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'payment'`,
      )
      expect(schemas).toHaveLength(1)

      const tables = await dataSource.query<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'payment' ORDER BY table_name`,
      )
      expect(tables.map(t => t.table_name)).toEqual(['payment_intents', 'webhook_events'])
    })

    it('When payment_intents UNIQUE constraints are inspected, Then provider_intent_id and external_id are unique', async () => {
      const constraints = await dataSource.query<{ constraint_name: string }[]>(
        `SELECT constraint_name FROM information_schema.table_constraints
         WHERE table_schema = 'payment' AND table_name = 'payment_intents'
           AND constraint_type = 'UNIQUE' ORDER BY constraint_name`,
      )
      expect(constraints.map(c => c.constraint_name)).toEqual([
        'UQ_payment_intents_external_id',
        'UQ_payment_intents_provider_intent_id',
      ])
    })

    it('When webhook_events UNIQUE constraints are inspected, Then event_id and external_id are unique', async () => {
      const constraints = await dataSource.query<{ constraint_name: string }[]>(
        `SELECT constraint_name FROM information_schema.table_constraints
         WHERE table_schema = 'payment' AND table_name = 'webhook_events'
           AND constraint_type = 'UNIQUE' ORDER BY constraint_name`,
      )
      expect(constraints.map(c => c.constraint_name)).toEqual([
        'UQ_webhook_events_event_id',
        'UQ_webhook_events_external_id',
      ])
    })

    it('When the reservations table is inspected, Then the four new columns exist as nullable', async () => {
      const cols = await dataSource.query<ColumnInfo[]>(
        `SELECT column_name, data_type, is_nullable, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = 'reservation' AND table_name = 'reservations'
           AND column_name IN ('booking_reference', 'payment_intent_id', 'guest_name', 'guest_email', 'guest_phone')
         ORDER BY column_name`,
      )

      expect(cols).toEqual([
        { column_name: 'booking_reference', data_type: 'character varying', is_nullable: 'YES', character_maximum_length: 32 },
        { column_name: 'guest_email',       data_type: 'character varying', is_nullable: 'YES', character_maximum_length: 320 },
        { column_name: 'guest_name',        data_type: 'character varying', is_nullable: 'YES', character_maximum_length: 200 },
        { column_name: 'guest_phone',       data_type: 'character varying', is_nullable: 'YES', character_maximum_length: 32 },
        { column_name: 'payment_intent_id', data_type: 'uuid',              is_nullable: 'YES', character_maximum_length: null },
      ])
    })

    it('When the booking_reference unique index is inspected, Then it exists as a partial index', async () => {
      const indexes = await dataSource.query<{ indexname: string; indexdef: string }[]>(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'reservation' AND tablename = 'reservations'
           AND indexname = 'UQ_reservations_booking_reference'`,
      )
      expect(indexes).toHaveLength(1)
      expect(indexes[0].indexdef).toMatch(/UNIQUE INDEX/)
      expect(indexes[0].indexdef).toMatch(/booking_reference/)
      expect(indexes[0].indexdef).toMatch(/WHERE \(booking_reference IS NOT NULL\)/)
    })

    it('When two payment_intents rows share provider_intent_id, Then the second insert raises 23505', async () => {
      const insert = (): Promise<unknown> =>
        dataSource.query(
          `INSERT INTO "payment"."payment_intents"
            (reservation_id, provider_intent_id, amount_cents, currency, status)
           VALUES ($1, $2, $3, $4, $5)`,
          ['11111111-1111-1111-1111-111111111111', 'pi_duplicate_test', 9900, 'BRL', 'pending'],
        )

      await insert()
      await expect(insert()).rejects.toMatchObject({ code: '23505' })
    })

    it('When two webhook_events rows share event_id, Then the second insert raises 23505', async () => {
      const insert = (): Promise<unknown> =>
        dataSource.query(
          `INSERT INTO "payment"."webhook_events" (event_id, event_type, payload)
           VALUES ($1, $2, $3::jsonb)`,
          ['evt_duplicate_test', 'payment_intent.succeeded', '{}'],
        )

      await insert()
      await expect(insert()).rejects.toMatchObject({ code: '23505' })
    })
  })

  describe('Given migrations have been run, When the two new migrations are reverted, Then the schema returns to its prior state', () => {
    beforeEach(async () => {
      await dataSource.runMigrations({ transaction: 'each' })
      await dataSource.undoLastMigration({ transaction: 'each' }) // AddBookingReferenceAndGuestDetails
      await dataSource.undoLastMigration({ transaction: 'each' }) // CreatePaymentSchema
    })

    it('Then the payment schema no longer exists', async () => {
      const schemas = await dataSource.query<{ schema_name: string }[]>(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'payment'`,
      )
      expect(schemas).toHaveLength(0)
    })

    it('Then the reservations table no longer exposes the four new columns', async () => {
      const cols = await dataSource.query<ColumnInfo[]>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'reservation' AND table_name = 'reservations'
           AND column_name IN ('booking_reference', 'payment_intent_id', 'guest_name', 'guest_email', 'guest_phone')`,
      )
      expect(cols).toEqual([])
    })

    it('Then the booking_reference unique index no longer exists', async () => {
      const indexes = await dataSource.query<{ indexname: string }[]>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'reservation' AND indexname = 'UQ_reservations_booking_reference'`,
      )
      expect(indexes).toHaveLength(0)
    })
  })
})

describe('Scenario: ReservationEntity exposes the four new booking columns', () => {
  it('When a ReservationEntity is constructed, Then bookingReference, paymentIntentId, guestName, guestEmail, guestPhone are assignable strings or null', () => {
    const entity = new ReservationEntity({
      bookingReference: 'LR-2605-7K3Q9',
      paymentIntentId:  '11111111-1111-1111-1111-111111111111',
      guestName:        'Alice',
      guestEmail:       'alice@example.com',
      guestPhone:       '+5511987654321',
    })

    expect(entity.bookingReference).toBe('LR-2605-7K3Q9')
    expect(entity.paymentIntentId).toBe('11111111-1111-1111-1111-111111111111')
    expect(entity.guestName).toBe('Alice')
    expect(entity.guestEmail).toBe('alice@example.com')
    expect(entity.guestPhone).toBe('+5511987654321')
  })

  it('When a ReservationEntity is constructed without booking-flow fields, Then they default to undefined (null on persistence)', () => {
    const entity = new ReservationEntity({
      roomId:    1,
      sessionId: 2,
    })

    expect(entity.bookingReference).toBeUndefined()
    expect(entity.paymentIntentId).toBeUndefined()
    expect(entity.guestName).toBeUndefined()
    expect(entity.guestEmail).toBeUndefined()
    expect(entity.guestPhone).toBeUndefined()
  })
})
