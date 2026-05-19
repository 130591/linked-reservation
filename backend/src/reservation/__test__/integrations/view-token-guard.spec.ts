import 'reflect-metadata'
import { Controller, Get, Module, UseGuards } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request = require('supertest')
import { createHmac } from 'crypto'

import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { ReservationViewTokenGuard } from '@/common/framework/guards/reservation-view-token.guard'
import { ReservationRepository } from '@/reservation/persist'
import { ConfigService } from '@/common/config'
import { Reservation } from '@/common/framework/decorators/reservation.decorator'

const SECRET          = 'view-token-guard-test-secret-32chars-ok'
const RESERVATION_EXT = 'res-view-ext-uuid-001'
const RESERVATION_ROW = { id: 1, externalId: RESERVATION_EXT, status: 'CONFIRMED' }

// ── Stub controller wired with the guard ───────────────────────────────────

@Controller('test')
@UseGuards(ReservationViewTokenGuard)
class StubController {
  @Get('confirmation')
  getConfirmation(@Reservation() reservation: any) {
    return { reservationId: reservation?.externalId ?? null }
  }
}

// ── Test module builder ────────────────────────────────────────────────────

async function buildApp(
  reservationRow: object | null = RESERVATION_ROW,
): Promise<{ app: INestApplication; tokenService: ReservationTokenService }> {
  const mockRepo = {
    findOneById: jest.fn().mockResolvedValue(reservationRow),
  }
  const mockConfig = {
    get: jest.fn().mockReturnValue(SECRET),
  }

  const module: TestingModule = await Test.createTestingModule({
    controllers: [StubController],
    providers: [
      ReservationTokenService,
      ReservationViewTokenGuard,
      { provide: ReservationRepository, useValue: mockRepo },
      { provide: ConfigService,         useValue: mockConfig },
    ],
  }).compile()

  const app = module.createNestApplication()
  await app.init()

  const tokenService = module.get(ReservationTokenService)
  return { app, tokenService }
}

function makeExpiredViewToken(reservationId: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const past    = Math.floor(Date.now() / 1000) - 60
  const claims  = { sub: reservationId, type: 'view', iat: past - 1, exp: past }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig     = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

// ── Scenarios ─────────────────────────────────────────────────────────────

describe('Scenario: ReservationViewTokenGuard — valid token in Authorization: Bearer', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a valid view token in the Authorization header', () => {
    it('When the guarded route is called, Then 200 and request[reservation] is the loaded entity', async () => {
      const token = await tokenService.generateViewToken(RESERVATION_EXT)

      const res = await request(app.getHttpServer())
        .get('/test/confirmation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)

      expect(res.body.reservationId).toBe(RESERVATION_EXT)
    })
  })
})

describe('Scenario: ReservationViewTokenGuard — valid token in ?token= query param', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a valid view token in the query string', () => {
    it('When the guarded route is called, Then 200 and reservation is loaded', async () => {
      const token = await tokenService.generateViewToken(RESERVATION_EXT)

      const res = await request(app.getHttpServer())
        .get(`/test/confirmation?token=${token}`)
        .expect(200)

      expect(res.body.reservationId).toBe(RESERVATION_EXT)
    })
  })
})

describe('Scenario: ReservationViewTokenGuard — session token rejected', () => {
  let app: INestApplication
  let tokenService: ReservationTokenService

  beforeEach(async () => {
    ({ app, tokenService } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given a session token (wrong type) in the Authorization header', () => {
    it('When the guarded route is called, Then 401', async () => {
      const sessionToken = tokenService.generate('ses-uuid-001')

      await request(app.getHttpServer())
        .get('/test/confirmation')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401)
    })
  })
})

describe('Scenario: ReservationViewTokenGuard — expired view token returns 410', () => {
  let app: INestApplication

  beforeEach(async () => {
    ({ app } = await buildApp())
  })
  afterEach(() => app.close())

  describe('Given an expired view token', () => {
    it('When the guarded route is called, Then 410 Gone', async () => {
      const expiredToken = makeExpiredViewToken(RESERVATION_EXT)

      await request(app.getHttpServer())
        .get('/test/confirmation')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(410)
    })
  })
})
