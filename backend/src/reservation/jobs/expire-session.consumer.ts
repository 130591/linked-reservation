import { Injectable } from '@nestjs/common'
import { SqsMessageHandler } from '@ssut/nestjs-sqs'
import { Message } from '@aws-sdk/client-sqs'
import { IsNull } from 'typeorm'
import { Transactional } from 'typeorm-transactional'
import { Inject } from '@nestjs/common'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { ReservationSessionRepository, ReservationRepository } from '@/reservation/persist'
import { SessionCreatedEvent } from '@/reservation/core/service/generate-link'

import { SessionExpiredPayload, EventQueues } from '@/common/events'
import { ReservationInternalQueues } from '@/reservation/events'
import { ConfigService } from '@/common/config'

@Injectable()
export class ExpireSessionConsumer {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly reservationRepo: ReservationRepository,
    private readonly configService: ConfigService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus
  ) { }

  @SqsMessageHandler(ReservationInternalQueues.SESSION_EXPIRE)
  @Transactional()
  async handle(message: Message): Promise<void> {
    const { sessionId, staffId } = JSON.parse(message.Body!) as SessionCreatedEvent
    const session = await this.sessionRepo.findOneById(sessionId)

    // Session already completed (payment confirmed) — nothing to do
    if (!session || session.status !== 'ACTIVE') return

    const result = await this.sessionRepo.update(
      { externalId: sessionId, status: 'ACTIVE' } as any,
      { status: 'EXPIRED' }
    )

    if (result.affected === 0) return

    // Release any active HOLD — room becomes available again
    await this.reservationRepo.update(
      { sessionId: session.id as any, status: 'HOLD' as any, deletedAt: IsNull() as any },
      { status: 'EXPIRED' }
    )

    const frontendUrl = this.configService.get('frontendUrl')

    await this.eventBus.publish<SessionExpiredPayload>(
      EventQueues.SESSION_EXPIRED,
      { 
        sessionId,
        staffId,
        stayName: session.stayName,
        checkIn: session.checkIn.toISOString(),
        checkOut: session.checkOut.toISOString(),
        expiredReason: 'TIMEOUT',
        newSessionUrl: `${frontendUrl}/admin/sessions/new?stayId=${session.stayId}`
      }
    )
  }
}