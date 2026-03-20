import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { IsNull } from 'typeorm'
import { Transactional } from 'typeorm-transactional'
import { Inject } from '@nestjs/common'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { ReservationSessionRepository, ReservationRepository } from '@/reservation/persist'
import { SessionCreatedEvent } from '@/reservation/core/service/generate-link'

export interface SessionExpiredEvent {
  sessionId: string
  staffId: string
}

@Injectable()
export class ExpireSessionConsumer {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly reservationRepo: ReservationRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus
  ) { }

  @SqsMessageHandler('reservation.session.expire')
  @Transactional()
  async handle(message: Message): Promise<void> {
    const { sessionId, staffId } = JSON.parse(message.Body!) as SessionCreatedEvent
    const session = await this.sessionRepo.findOneById(sessionId)

    // Session already completed (payment confirmed) — nothing to do
    if (!session || session.status !== 'ACTIVE') return

    const result = await this.sessionRepo.update(
      { id: sessionId, status: 'ACTIVE' },
      { status: 'EXPIRED' }
    )

    if (result.affected === 0) return

    // Release any active HOLD — room becomes available again
    await this.reservationRepo.update(
      { sessionId, status: 'HOLD' as any, deletedAt: IsNull() as any },
      { status: 'EXPIRED' }
    )

    await this.eventBus.publish<SessionExpiredEvent>(
      'reservation.session.expired',
      { sessionId, staffId }
    )
  }
}