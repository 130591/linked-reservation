import { ConfigService } from "@/common/config"
import { Injectable } from "@nestjs/common"
import { createHmac, timingSafeEqual } from "crypto"

const JWT_HEADER     = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
const VIEW_TOKEN_TTL = 30 * 24 * 60 * 60  // 30 days in seconds

@Injectable()
export class ReservationTokenService {
  private readonly secret: string

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get('reservationTokenSecret')
    if (!secret || secret.length < 32) {
      throw new Error('reservationTokenSecret must be at least 32 characters')
    }
    this.secret = secret
  }

  generate(sessionId: string): string {
    const payload = Buffer.from(sessionId).toString('base64url')
    const sig = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url')
    return `${payload}.${sig}`
  }

  verify(token: string): string | null {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null

    const expected = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url')

    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    return Buffer.from(payload, 'base64url').toString('utf8')
  }

  generateViewToken(reservationId: string): string {
    const now     = Math.floor(Date.now() / 1000)
    const claims  = { sub: reservationId, type: 'view', iat: now, exp: now + VIEW_TOKEN_TTL }
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
    const signing = `${JWT_HEADER}.${payload}`
    const sig     = createHmac('sha256', this.secret).update(signing).digest('base64url')
    return `${signing}.${sig}`
  }

  verifyViewToken(token: string): { reservationId: string } | null {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, payload, sig] = parts
    const expected = createHmac('sha256', this.secret)
      .update(`${header}.${payload}`)
      .digest('base64url')

    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null

    let claims: Record<string, unknown>
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    } catch {
      return null
    }

    if (claims['type'] !== 'view')                              return null
    if (typeof claims['sub'] !== 'string' || !claims['sub'])    return null
    if (typeof claims['exp'] === 'number' &&
        claims['exp'] < Math.floor(Date.now() / 1000))          return null

    return { reservationId: claims['sub'] as string }
  }
}