import { Injectable } from '@nestjs/common'
import { createHmac } from 'crypto'
import { Transactional } from 'typeorm-transactional'
import { ConfigService } from '@/common/config'
import { ReservationSessionRepository, ReservationSessionEntity } from '@/reservation/persist'

interface GenerateLinkCommand {
  hotelId: string
  checkIn: Date
  checkOut: Date
  guests: number
  staffId: string
}

interface GenerateLinkResult {
  token: string
  sessionId: string
  expiresAt: Date
}

@Injectable()
export class GenerateLink {
  private readonly secret = this.config.get('reservationTokenSecret')

  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly config: ConfigService
  ) { }

  private generateToken(sessionId: string): string {
    const payload = Buffer.from(sessionId).toString('base64url')
    const sig = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url')
    return `${payload}.${sig}`
  }

  private generateNewSession(command: GenerateLinkCommand): ReservationSessionEntity {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    return new ReservationSessionEntity({
      hotelId: command.hotelId,
      checkIn: command.checkIn,
      checkOut: command.checkOut,
      guests: command.guests,
      status: 'ACTIVE',
      expiresAt,
      version: 1
    })
  }

  @Transactional()
  async handle(command: GenerateLinkCommand): Promise<GenerateLinkResult> {
    const session = await this.sessionRepo.save(
      this.generateNewSession(command)
    )

    return {
      token: this.generateToken(session.id),
      sessionId: session.id,
      expiresAt: session.expiresAt
    }
  }
}
