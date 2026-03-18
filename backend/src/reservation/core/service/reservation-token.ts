import { ConfigService } from "@/common/config"
import { Injectable } from "@nestjs/common"
import { createHmac, timingSafeEqual } from "crypto"

@Injectable()
export class ReservationTokenService {
  private readonly secret = this.config.get('reservationTokenSecret')

  constructor(private readonly config: ConfigService) { }

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