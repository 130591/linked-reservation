import 'reflect-metadata'
import {
  Controller,
  Get,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request = require('supertest')
import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { ReservationViewTokenGuard } from '@/common/framework/guards/reservation-view-token.guard'
import { BookingController } from '@/reservation/http/controller/booking'
import { ReservationController } from '@/reservation/http/controller/reservation'
import { ReservationRepository, RoomRepository, ReservationSessionRepository, StayRepository } from '@/reservation/persist'
import { PaymentIntentRepository } from '@/payment/persist/repositories/payment-intent.repository'
import { PaymentAPI } from '@/payment/external-api/payment-api'
import { ConfirmPayment } from '@/reservation/core/service'
import { GetAvailableRooms } from '@/reservation/core/service/get-available-rooms'
import { SelectRoom } from '@/reservation/core/service/select-room'
import { ConfigService } from '@/common/config'
import { PaymentIntentStatus } from '@/payment/core/domain'
import { ok } from 'neverthrow'
import { WebhookController } from '@/payment/http/controller/webhook'
import { PaymentIntentService } from '@/payment/core/service/payment-intent.service'
import { WebhookEventRepository } from '@/payment/persist/repositories/webhook-event.repository'
import { STRIPE_CLIENT } from '@/common/integrations/stripe'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: any, _key: any, descriptor: any) => descriptor,
}))

// ── Constants ───────────────────────────────────────────────────────────────

const SECRET          = 'booking-endpoint-test-secret-32chars-ok!'
const SESSION_EXT     = 'a1b2c3d4-e5f6-4890-8bcd-ef1234567890'
const STAY_ID         = 'b2c3d4e5-f6a7-4901-9cde-f12345678901'
const RESERVATION_EXT = 'c3d4e5f6-a7b8-4012-8def-123456789012'
const ROOM_EXT        = 'd4e5f6a7-b8c9-4123-aaef-234567890123'
const INTENT_EXT      = 'e5f6a7b8-c9d0-4234-bfab-345678901234'
const BOOKING_REF     = 'LR-2605-TSTR1'

const SESSION_ROW = {
  externalId: SESSION_EXT,
  stayId: STAY_ID,
  stayName: 'Pousada do Mar',
  checkIn: new Date('2026-11-01'),
  checkOut: new Date('2026-11-05'),
  guests: 2,
  status: 'ACTIVE',
  isExpired: () => false,
}

const RESERVATION_ROW = {
  externalId: RESERVATION_EXT,
  roomId: ROOM_EXT,
  sessionId: SESSION_EXT,
  checkIn: new Date('2026-11-01'),
  checkOut: new Date('2026-11-05'),
  status: 'CONFIRMED',
  bookingReference: BOOKING_REF,
  paymentIntentId: INTENT_EXT,
  guestName: 'Maria Silva',
  guestEmail: 'maria@example.com',
  guestPhone: '+5511999990001',
}

const ROOM_ROW = { externalId: ROOM_EXT, name: 'Suite Mar', stayId: STAY_ID }
const STAY_ROW = { externalId: STAY_ID, name: 'Pousada do Mar', whatsappNumber: '+5511900000001' }

const PAYMENT_INTENT_ROW = {
  externalId: INTENT_EXT,
  amountCents: 30000,
  currency: 'BRL',
  status: PaymentIntentStatus.succeeded,
  confirmedAt: new Date('2026-11-01T10:00:00Z'),
  createdAt: new Date(Date.now() - 30_000), // 30s ago
  lastEventPayload: {
    guestName: 'Maria Silva',
    guestEmail: 'maria@example.com',
    guestPhone: '+5511999990001',
  },
}

// ── Test module builder ─────────────────────────────────────────────────────

async function buildApp(overrides: {
  sessionRow?: any
  reservationRow?: any
  intentRow?: any
  confirmPaymentResult?: any
} = {}): Promise<{ app: INestApplication; tokenService: ReservationTokenService }> {
  const sessionRow    = overrides.sessionRow    ?? SESSION_ROW
  const reservationRow = overrides.reservationRow ?? RESERVATION_ROW
  const intentRow     = overrides.intentRow     ?? PAYMENT_INTENT_ROW

  const mockSessionRepo     = { findOneById: jest.fn().mockResolvedValue(sessionRow) }
  const mockReservationRepo = { findOneById: jest.fn().mockResolvedValue(reservationRow) }
  const mockRoomRepo        = { findOneById: jest.fn().mockResolvedValue(ROOM_ROW) }
  const mockStayRepo        = { findOneById: jest.fn().mockResolvedValue(STAY_ROW) }
  const mockPaymentIntentRepo = { findOneById: jest.fn().mockResolvedValue(intentRow) }

  const mockPaymentAPI = {
    createIntent: jest.fn().mockResolvedValue(ok({ intentId: INTENT_EXT, clientSecret: 'cs_test_123' })),
    getStatus: jest.fn().mockResolvedValue(ok({ status: intentRow?.status, succeededAt: intentRow?.confirmedAt })),
    refreshFromProvider: jest.fn().mockResolvedValue(ok({ status: PaymentIntentStatus.succeeded })),
  }

  const confirmPaymentResult = overrides.confirmPaymentResult ??
    ok({ reservationId: RESERVATION_EXT, bookingReference: BOOKING_REF })

  const mockConfirmPayment = {
    handle: jest.fn().mockResolvedValue(confirmPaymentResult),
  }

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'stripePublishableKey') return 'pk_test_abc'
      return SECRET
    }),
  }

  const mockGetAvailableRooms = { handle: jest.fn().mockResolvedValue(ok([])) }
  const mockSelectRoom        = { handle: jest.fn().mockResolvedValue(ok({})) }

  const module: TestingModule = await Test.createTestingModule({
    controllers: [BookingController, ReservationController],
    providers: [
      ReservationTokenService,
      ReservationTokenGuard,
      ReservationViewTokenGuard,
      { provide: ReservationSessionRepository, useValue: mockSessionRepo },
      { provide: ReservationRepository,        useValue: mockReservationRepo },
      { provide: RoomRepository,               useValue: mockRoomRepo },
      { provide: StayRepository,               useValue: mockStayRepo },
      { provide: PaymentIntentRepository,      useValue: mockPaymentIntentRepo },
      { provide: PaymentAPI,                   useValue: mockPaymentAPI },
      { provide: ConfirmPayment,               useValue: mockConfirmPayment },
      { provide: GetAvailableRooms,            useValue: mockGetAvailableRooms },
      { provide: SelectRoom,                   useValue: mockSelectRoom },
      { provide: ConfigService,                useValue: mockConfig },
    ],
  }).compile()

  const app = module.createNestApplication()
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  await app.init()

  const tokenService = module.get(ReservationTokenService)
  return { app, tokenService }
}

// ── POST /booking/payment-intent ─────────────────────────────────────────────

describe('Scenario: POST /booking/payment-intent — happy path', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a session with a HOLD and valid DTO', () => {
    it('When POST /booking/payment-intent is called, Then 200 with { intentId, clientSecret, publishableKey }', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      const res = await request(app.getHttpServer())
        .post('/booking/payment-intent')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          reservationId: RESERVATION_EXT,
          amountCents: 30000,
          guestName: 'Maria Silva',
          guestEmail: 'maria@example.com',
          guestPhone: '+5511999990001',
        })
        .expect(201)

      expect(res.body).toMatchObject({
        intentId: INTENT_EXT,
        clientSecret: 'cs_test_123',
        publishableKey: 'pk_test_abc',
      })
    })
  })
})

describe('Scenario: POST /booking/payment-intent — invalid email', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a session and a DTO with invalid email', () => {
    it('When POST /booking/payment-intent is called, Then 400 with validation error', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      await request(app.getHttpServer())
        .post('/booking/payment-intent')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          reservationId: RESERVATION_EXT,
          amountCents: 30000,
          guestName: 'Maria Silva',
          guestEmail: 'not-an-email',
          guestPhone: '+5511999990001',
        })
        .expect(400)
    })
  })
})

// ── GET /booking/payment-status ───────────────────────────────────────────────

describe('Scenario: GET /booking/payment-status — pending, younger than 90s', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService
  let mockPaymentAPI: any

  beforeEach(async () => {
    const recentIntent = {
      ...PAYMENT_INTENT_ROW,
      status: PaymentIntentStatus.pending,
      confirmedAt: null,
      createdAt: new Date(Date.now() - 30_000), // 30s ago — NOT stale
    }
    ;({ app, tokenService } = await buildApp({ intentRow: recentIntent }))
    mockPaymentAPI = app['httpAdapter']?.getHttpServer()
  })
  afterEach(() => app.close())

  describe('Given an intent in pending, created 30 seconds ago', () => {
    it('When GET /booking/payment-status is called, Then response is pending and Stripe is NOT called', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      const module: TestingModule = await Test.createTestingModule({
        controllers: [BookingController, ReservationController],
        providers: [
          ReservationTokenService,
          ReservationTokenGuard,
          ReservationViewTokenGuard,
          {
            provide: ReservationSessionRepository,
            useValue: { findOneById: jest.fn().mockResolvedValue(SESSION_ROW) },
          },
          { provide: ReservationRepository,   useValue: { findOneById: jest.fn() } },
          { provide: RoomRepository,           useValue: { findOneById: jest.fn() } },
          { provide: StayRepository,           useValue: { findOneById: jest.fn() } },
          {
            provide: PaymentIntentRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue({
                externalId: INTENT_EXT,
                status: PaymentIntentStatus.pending,
                confirmedAt: null,
                createdAt: new Date(Date.now() - 30_000),
              }),
            },
          },
          {
            provide: PaymentAPI,
            useValue: { refreshFromProvider: jest.fn().mockResolvedValue(ok({})) },
          },
          { provide: ConfirmPayment,    useValue: { handle: jest.fn() } },
          { provide: GetAvailableRooms, useValue: { handle: jest.fn() } },
          { provide: SelectRoom,        useValue: { handle: jest.fn() } },
          { provide: ConfigService,     useValue: { get: jest.fn().mockReturnValue(SECRET) } },
        ],
      }).compile()

      const freshApp = module.createNestApplication()
      await freshApp.init()
      const freshTokenService = module.get(ReservationTokenService)
      const freshToken = freshTokenService.generate(SESSION_EXT)
      const refreshSpy = module.get(PaymentAPI).refreshFromProvider as jest.Mock

      const res = await request(freshApp.getHttpServer())
        .get(`/booking/payment-status?intentId=${INTENT_EXT}`)
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200)

      expect(res.body.status).toBe('pending')
      expect(refreshSpy).not.toHaveBeenCalled()
      await freshApp.close()
    })
  })
})

describe('Scenario: GET /booking/payment-status — pending, older than 90s, Stripe says succeeded', () => {
  let app: INestApplication

  beforeEach(async () => {
    ;({ app } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given an intent in pending created 120 seconds ago and Stripe reports succeeded', () => {
    it('When GET /booking/payment-status is called, Then the response is succeeded', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [BookingController, ReservationController],
        providers: [
          ReservationTokenService,
          ReservationTokenGuard,
          ReservationViewTokenGuard,
          {
            provide: ReservationSessionRepository,
            useValue: { findOneById: jest.fn().mockResolvedValue(SESSION_ROW) },
          },
          { provide: ReservationRepository,   useValue: { findOneById: jest.fn() } },
          { provide: RoomRepository,           useValue: { findOneById: jest.fn() } },
          { provide: StayRepository,           useValue: { findOneById: jest.fn() } },
          {
            provide: PaymentIntentRepository,
            useValue: {
              findOneById: jest.fn().mockResolvedValue({
                externalId: INTENT_EXT,
                status: PaymentIntentStatus.pending,
                confirmedAt: null,
                createdAt: new Date(Date.now() - 120_000), // 2 minutes ago — STALE
              }),
            },
          },
          {
            provide: PaymentAPI,
            useValue: {
              refreshFromProvider: jest
                .fn()
                .mockResolvedValue(ok({ status: PaymentIntentStatus.succeeded })),
            },
          },
          { provide: ConfirmPayment,    useValue: { handle: jest.fn() } },
          { provide: GetAvailableRooms, useValue: { handle: jest.fn() } },
          { provide: SelectRoom,        useValue: { handle: jest.fn() } },
          { provide: ConfigService,     useValue: { get: jest.fn().mockReturnValue(SECRET) } },
        ],
      }).compile()

      const freshApp = module.createNestApplication()
      await freshApp.init()
      const freshTokenService = module.get(ReservationTokenService)
      const freshToken = freshTokenService.generate(SESSION_EXT)
      const refreshSpy = module.get(PaymentAPI).refreshFromProvider as jest.Mock

      const res = await request(freshApp.getHttpServer())
        .get(`/booking/payment-status?intentId=${INTENT_EXT}`)
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200)

      expect(res.body.status).toBe('succeeded')
      expect(refreshSpy).toHaveBeenCalledWith(INTENT_EXT)
      await freshApp.close()
    })
  })
})

// ── POST /booking/confirmation ───────────────────────────────────────────────

describe('Scenario: POST /booking/confirmation — happy path', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a succeeded intent and HOLD reservation', () => {
    it('When POST /booking/confirmation is called, Then reservation is CONFIRMED, response has viewToken and correct bookingReference', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      const res = await request(app.getHttpServer())
        .post('/booking/confirmation')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ intentId: INTENT_EXT })
        .expect(201)

      expect(res.body.viewToken).toBeDefined()
      expect(typeof res.body.viewToken).toBe('string')
      expect(res.body.confirmation.bookingReference).toBe(BOOKING_REF)
      expect(res.body.confirmation.guest.email).toBe('maria@example.com')
      expect(res.body.confirmation.room.id).toBe(ROOM_EXT)
    })
  })
})

describe('Scenario: POST /booking/confirmation — idempotent (already CONFIRMED)', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given an already CONFIRMED reservation for the same intentId', () => {
    it('When POST /booking/confirmation is called again, Then 201 with same bookingReference and a fresh viewToken', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      const res = await request(app.getHttpServer())
        .post('/booking/confirmation')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ intentId: INTENT_EXT })
        .expect(201)

      expect(res.body.viewToken).toBeDefined()
      expect(res.body.confirmation.bookingReference).toBe(BOOKING_REF)
    })
  })
})

// ── GET /booking/confirmation ─────────────────────────────────────────────────

describe('Scenario: GET /booking/confirmation — valid view token', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a valid view token', () => {
    it('When GET /booking/confirmation is called, Then ConfirmationView is returned and Referrer-Policy: no-referrer is set', async () => {
      const viewToken = tokenService.generateViewToken(RESERVATION_EXT)

      const res = await request(app.getHttpServer())
        .get('/booking/confirmation')
        .set('Authorization', `Bearer ${viewToken}`)
        .expect(200)

      expect(res.headers['referrer-policy']).toBe('no-referrer')
      expect(res.body.bookingReference).toBe(BOOKING_REF)
      expect(res.body.property.name).toBe('Pousada do Mar')
      expect(res.body.room.name).toBe('Suite Mar')
      expect(res.body.guest.email).toBe('maria@example.com')
    })
  })
})

describe('Scenario: GET /booking/confirmation — session token rejected', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a session token on the view-token-guarded route', () => {
    it('When GET /booking/confirmation is called, Then 401', async () => {
      const sessionToken = tokenService.generate(SESSION_EXT)

      await request(app.getHttpServer())
        .get('/booking/confirmation')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401)
    })
  })
})

// ── Route registration ────────────────────────────────────────────────────────

describe('Scenario: Route registration — all booking and webhook routes are accessible', () => {
  let app: INestApplication

  beforeEach(async () => {
    const mockStripe = {
      webhooks: { constructEvent: jest.fn().mockImplementation(() => { throw new Error('bad sig') }) },
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController, ReservationController, WebhookController],
      providers: [
        ReservationTokenService,
        ReservationTokenGuard,
        ReservationViewTokenGuard,
        { provide: STRIPE_CLIENT,                useValue: mockStripe },
        { provide: ReservationSessionRepository, useValue: { findOneById: jest.fn().mockResolvedValue(null) } },
        { provide: ReservationRepository,        useValue: { findOneById: jest.fn() } },
        { provide: RoomRepository,               useValue: { findOneById: jest.fn() } },
        { provide: StayRepository,               useValue: { findOneById: jest.fn() } },
        { provide: PaymentIntentRepository,      useValue: { findOneById: jest.fn() } },
        { provide: PaymentAPI,                   useValue: {} },
        { provide: ConfirmPayment,               useValue: { handle: jest.fn() } },
        { provide: GetAvailableRooms,            useValue: { handle: jest.fn() } },
        { provide: SelectRoom,                   useValue: { handle: jest.fn() } },
        { provide: PaymentIntentService,         useValue: { processSucceeded: jest.fn(), processFailed: jest.fn() } },
        { provide: WebhookEventRepository,       useValue: { save: jest.fn() } },
        { provide: ConfigService,                useValue: { get: jest.fn().mockReturnValue(SECRET) } },
      ],
    }).compile()

    app = module.createNestApplication({ rawBody: true })
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
    await app.init()
  })
  afterEach(() => app.close())

  describe('Given the application is booted', () => {
    it('When routes are inspected, Then all booking and webhook routes are registered (not 404)', async () => {
      // Guard-protected routes return 401 (route exists), not 404 (route missing)
      const r1 = await request(app.getHttpServer()).post('/booking/payment-intent')
      expect(r1.status).not.toBe(404)

      const r2 = await request(app.getHttpServer()).get('/booking/payment-status')
      expect(r2.status).not.toBe(404)

      const r3 = await request(app.getHttpServer()).post('/booking/confirmation')
      expect(r3.status).not.toBe(404)

      const r4 = await request(app.getHttpServer()).get('/booking/confirmation')
      expect(r4.status).not.toBe(404)

      // Webhook returns 400 (invalid signature) not 404 (route missing)
      const r5 = await request(app.getHttpServer())
        .post('/payment/webhook')
        .set('stripe-signature', 'invalid')
        .set('content-type', 'application/json')
        .send('{}')
      expect(r5.status).not.toBe(404)
    })
  })
})
