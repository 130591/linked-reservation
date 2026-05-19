import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { ConfigService } from '@/common/config'
import { createHmac } from 'crypto'

const SECRET = 'test-secret-with-at-least-32-characters-ok'

function makeService(): ReservationTokenService {
  const config = { get: jest.fn().mockReturnValue(SECRET) } as unknown as ConfigService
  return new ReservationTokenService(config)
}

function makeExpiredViewToken(reservationId: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const past    = Math.floor(Date.now() / 1000) - 60
  const claims  = { sub: reservationId, type: 'view', iat: past - 1, exp: past }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig     = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

describe('ReservationTokenService — view token methods', () => {
  let service: ReservationTokenService

  beforeEach(() => {
    service = makeService()
  })

  describe('Given a valid reservationId', () => {
    it('generateViewToken + verifyViewToken round-trips to the same reservationId', () => {
      const reservationId = 'res-uuid-round-trip-001'
      const token  = service.generateViewToken(reservationId)
      const result = service.verifyViewToken(token)

      expect(result).not.toBeNull()
      expect(result!.reservationId).toBe(reservationId)
    })
  })

  describe('Given a view token', () => {
    it('verify (session-token method) returns null due to format mismatch', () => {
      const token = service.generateViewToken('res-type-mismatch')
      expect(service.verify(token)).toBeNull()
    })
  })

  describe('Given a session token', () => {
    it('verifyViewToken returns null because type is not view', () => {
      const sessionToken = service.generate('ses-uuid-001')
      const result = service.verifyViewToken(sessionToken)
      expect(result).toBeNull()
    })
  })

  describe('Given a tampered view token', () => {
    it('verifyViewToken returns null when the signature is broken', () => {
      const token    = service.generateViewToken('res-tampered')
      const tampered = token.slice(0, -5) + 'XXXXX'
      const result   = service.verifyViewToken(tampered)
      expect(result).toBeNull()
    })
  })

  describe('Given a view token with exp in the past', () => {
    it('verifyViewToken returns null', () => {
      const expiredToken = makeExpiredViewToken('res-expired-001')
      const result = service.verifyViewToken(expiredToken)
      expect(result).toBeNull()
    })
  })
})
