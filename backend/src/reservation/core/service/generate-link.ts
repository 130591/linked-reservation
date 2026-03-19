import { Injectable } from '@nestjs/common'
import { err, ok, Result } from 'neverthrow'
import { Transactional } from 'typeorm-transactional'
import { ReservationSessionRepository, ReservationSessionEntity } from '@/reservation/persist'
import { Period } from '../domain'
import { ReservationTokenService } from './reservation-token'
import { DomainError } from '@/common/exceptions'

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

type GenerateLinkError = ReturnType<
  typeof DomainError.CHECK_IN_IN_PAST
  | typeof DomainError.CHECK_OUT_BEFORE_CHECK_IN
  | typeof DomainError.MINIMUM_DURATION_NOT_MET
  | typeof DomainError.MAX_STAYING_DAYS_EXCEEDED
>

@Injectable()
export class GenerateLink {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly tokenService: ReservationTokenService
  ) { }

  private generateNewSession(
    command: GenerateLinkCommand,
    period: Period
  ): ReservationSessionEntity {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    return new ReservationSessionEntity({
      hotelId: command.hotelId,
      checkIn: period.getStartDate(),
      checkOut: period.getEndDate(),
      guests: command.guests,
      staffId: command.staffId,
      status: 'ACTIVE',
      expiresAt,
      version: 1
    })
  }

  @Transactional()
  async handle(
    command: GenerateLinkCommand
  ): Promise<Result<GenerateLinkResult, GenerateLinkError>> {

    const periodResult = Period.create(command.checkIn, command.checkOut)
    if (periodResult.isErr()) return err(periodResult.error)

    const session = await this.sessionRepo.save(
      this.generateNewSession(command, periodResult.value)
    )

    return ok({
      token: this.tokenService.generate(session.id),
      sessionId: session.id,
      expiresAt: session.expiresAt
    })
  }
}