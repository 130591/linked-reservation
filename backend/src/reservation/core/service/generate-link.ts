import { Inject, Injectable } from '@nestjs/common'
import { err, ok, Result } from 'neverthrow'
import { Transactional } from 'typeorm-transactional'
import { ReservationSessionRepository, ReservationSessionEntity } from '@/reservation/persist'
import { Period } from '../domain'
import { ReservationTokenService } from './reservation-token'
import { DomainError } from '@/common/exceptions'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { GenerateLinkCommand } from '@/reservation/http/dto'
import { EventQueues, SessionLinkGeneratedPayload } from '@/common/events'
import { ConfigService } from '@/common/config'

import { ReservationInternalQueues } from '@/reservation/events'

export interface GenerateLinkResult {
  token: string
  sessionId: string
  expiresAt: Date
}

export interface SessionCreatedEvent {
  sessionId: string
  staffId: string
  expiresAt: Date
}

export type GenerateLinkError = ReturnType<
  typeof DomainError.CHECK_IN_IN_PAST
  | typeof DomainError.CHECK_OUT_BEFORE_CHECK_IN
  | typeof DomainError.MINIMUM_DURATION_NOT_MET
  | typeof DomainError.MAX_STAYING_DAYS_EXCEEDED
>

@Injectable()
export class GenerateLink {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly tokenService: ReservationTokenService,
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus
  ) { }

  private generateNewSession(
    command: GenerateLinkCommand,
    period: Period
  ): ReservationSessionEntity {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    return new ReservationSessionEntity({
      stayId: command.stayId,
      stayName: command.stayName,
      checkIn: period.getStartDate(),
      checkOut: period.getEndDate(),
      guests: command.guests,
      staffId: command.staffId,
      customer: {
        name: command.customerName
      },
      status: 'ACTIVE',
      expiresAt,
      version: 1
    })
  }

  // SQS support until 900s — guarantees that it does not overflow
  private calculateDelay(expiresAt: Date): number {
    const ms = expiresAt.getTime() - Date.now()
    return Math.min(Math.max(Math.floor(ms / 1000), 0), 900)
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

    await this.eventBus.publish<SessionCreatedEvent>(
      ReservationInternalQueues.SESSION_EXPIRE,
      { sessionId: session.externalId, staffId: command.staffId, expiresAt: session.expiresAt },
      { delaySeconds: this.calculateDelay(session.expiresAt) }
    )

    const token = this.tokenService.generate(session.externalId)
    const frontendUrl = this.configService.get('frontendUrl')

    await this.eventBus.publish<SessionLinkGeneratedPayload>(
      EventQueues.SESSION_LINK_GENERATED,
      {
        sessionId: session.externalId,
        staffId: command.staffId,
        token,
        stayId: session.stayId,
        stayName: session.stayName,
        customerName: session.customer?.name || '',
        checkIn: session.checkIn.toISOString(),
        checkOut: session.checkOut.toISOString(),
        bookingLink: `${frontendUrl}/reservation?token=${token}`
      }
    )

    return ok({
      token,
      sessionId: session.externalId,
      expiresAt: session.expiresAt
    })
  }
}