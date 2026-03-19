import { ConfigService } from "@/common/config"
import { Injectable } from "@nestjs/common"
import { createHmac, timingSafeEqual } from "crypto"

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
}