import { ExpireSessionConsumer } from '@/reservation/jobs/expire-session.consumer'
import { FakeReservationRepository, FakeSessionRepository } from '@/reservation/__test__/fixture/repos'
import { buildMessage, buildSession, buildReservation } from '@/reservation/__test__/fixture/helpers'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'
import { EventQueues } from '@/common/events'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
}))

describe('Scenario: Expire a Reservation Session after timeout', () => {
  let consumer: ExpireSessionConsumer
  let sessionRepo: FakeSessionRepository
  let reservationRepo: FakeReservationRepository
  let eventBus: FakeEventBus
  let configService: any

  beforeEach(() => {
    sessionRepo = new FakeSessionRepository()
    reservationRepo = new FakeReservationRepository()
    eventBus = new FakeEventBus()
    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') }

    consumer = new ExpireSessionConsumer(
      sessionRepo as any,
      reservationRepo as any,
      configService,
      eventBus
    )
  })

  describe('Given an ACTIVE session with a HOLD reservation', () => {
    const sessionId = 'ses-001'
    const staffId = 'staff-1'

    beforeEach(() => {
      sessionRepo.seed(buildSession({ id: sessionId }))
      reservationRepo.seed(buildReservation({ id: 'res-001', sessionId }))
    })

    it('When the expiration message arrives, then the session status must change to EXPIRED', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      const session = sessionRepo.get(sessionId)!
      expect(session.status).toBe('EXPIRED')
    })

    it('And any HOLD reservation linked to this session must also be marked as EXPIRED', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      const reservations = reservationRepo.getAll()
      expect(reservations.every(r => r.status === 'EXPIRED')).toBe(true)
    })

    it('And a SessionExpiredEvent must be published to notify downstream consumers', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      expect(eventBus.published).toHaveLength(1)
      expect(eventBus.published[0]).toEqual({
        queue: EventQueues.SESSION_EXPIRED,
        payload: {
          sessionId,
          staffId,
          hotelName: 'Grand Hotel',
          checkIn: '2030-06-01T00:00:00.000Z',
          checkOut: '2030-06-05T00:00:00.000Z',
          expiredReason: 'TIMEOUT',
          newSessionUrl: 'http://localhost:3000/admin/sessions/new?hotelId=hotel-1'
        },
        options: undefined,
      })
    })
  })

  describe('Given a session that was already COMPLETED (payment confirmed before expiration)', () => {
    const sessionId = 'ses-002'
    const staffId = 'staff-1'

    beforeEach(() => {
      sessionRepo.seed(buildSession({ id: sessionId, status: 'COMPLETED' }))
      reservationRepo.seed(buildReservation({ id: 'res-002', sessionId, status: 'CONFIRMED' }))
    })

    it('When the expiration message arrives, then the session must remain COMPLETED (no side-effects)', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      const session = sessionRepo.get(sessionId)!
      expect(session.status).toBe('COMPLETED')
    })

    it('And the reservation must remain CONFIRMED', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      const reservations = reservationRepo.getAll()
      expect(reservations[0].status).toBe('CONFIRMED')
    })

    it('And no event must be emitted', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      expect(eventBus.published).toHaveLength(0)
    })
  })

  describe('Given a session that no longer exists in the database', () => {
    it('When the expiration message arrives, then the consumer must do nothing gracefully', async () => {
      await consumer.handle(buildMessage({ sessionId: 'non-existent', staffId: 'staff-x' }))

      expect(eventBus.published).toHaveLength(0)
    })
  })

  describe('Given an ACTIVE session with multiple HOLD reservations (e.g. room was changed)', () => {
    const sessionId = 'ses-003'
    const staffId = 'staff-1'

    beforeEach(() => {
      sessionRepo.seed(buildSession({ id: sessionId }))
      // Previous room (soft-deleted, should NOT be expired again)
      reservationRepo.seed(buildReservation({
        id: 'res-old',
        sessionId,
        status: 'HOLD',
        deletedAt: new Date(),
      }))
      // Current room (active HOLD)
      reservationRepo.seed(buildReservation({
        id: 'res-current',
        sessionId,
        status: 'HOLD',
        deletedAt: null,
      }))
    })

    it('When the expiration message arrives, then only the non-deleted HOLD reservation must be expired', async () => {
      await consumer.handle(buildMessage({ sessionId, staffId }))

      const reservations = reservationRepo.getAll()
      const current = reservations.find(r => r.id === 'res-current')!
      const old = reservations.find(r => r.id === 'res-old')!

      expect(current.status).toBe('EXPIRED')
      // The old one was already soft-deleted with HOLD status — it shouldn't be touched
      expect(old.status).toBe('HOLD')
    })
  })
})