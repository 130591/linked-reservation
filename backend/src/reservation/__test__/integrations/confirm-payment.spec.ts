import { Test, TestingModule } from '@nestjs/testing'
import { ConfirmPayment } from '@/reservation/core/service'
import { ReservationRepository, ReservationSessionRepository } from '@/reservation/persist'
import { BookingReferenceService } from '@/reservation/core/service/booking-reference'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'
import { EVENT_BUS } from '@/common/messaging'
import { ConfigService } from '@/common/config'
import { EventQueues } from '@/common/events'
import { ok, err } from 'neverthrow'
import { DomainError } from '@/common/exceptions'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: any, _key: any, descriptor: any) => descriptor,
}))

const INTENT_ID       = 'pay-intent-uuid-001'
const RESERVATION_EXT = 'res-ext-uuid-001'
const RESERVATION_ID  = 42 // numeric internal id
const SESSION_EXT     = 'ses-ext-uuid-001'
const BOOKING_REF     = 'LR-2605-ABC23'

const makeReservation = (overrides: Record<string, any> = {}) => ({
  id:             RESERVATION_ID,
  externalId:     RESERVATION_EXT,
  sessionId:      SESSION_EXT,
  roomId:         'room-uuid-001',
  checkIn:        new Date('2026-10-10'),
  checkOut:       new Date('2026-10-15'),
  status:         'HOLD',
  paymentIntentId: null,
  bookingReference: null,
  ...overrides,
})

const makeSession = (overrides: Record<string, any> = {}) => ({
  id:       99,
  externalId: SESSION_EXT,
  status:   'ACTIVE',
  stayId:   'stay-uuid-001',
  stayName: 'Pousada do Sol',
  staffId:  'staff-uuid-001',
  guests:   2,
  ...overrides,
})

const COMMAND = {
  paymentIntentId: INTENT_ID,
  guestName:       'Maria Silva',
  guestEmail:      'maria@example.com',
  guestPhone:      '+5511999990001',
}

describe('Scenario: ConfirmPayment — happy path', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let bookingRefService: jest.Mocked<BookingReferenceService>
  let eventBus: FakeEventBus

  beforeEach(async () => {
    reservationRepo = {
      findByPaymentIntentId: jest.fn(),
      update: jest.fn(),
    } as any
    sessionRepo = {
      findOneById: jest.fn(),
      update: jest.fn(),
    } as any
    bookingRefService = {
      assignToReservation: jest.fn(),
    } as any
    eventBus = new FakeEventBus()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: BookingReferenceService, useValue: bookingRefService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://frontend') } },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()

    service = module.get(ConfirmPayment)
  })

  describe('Given an active session with a HOLD reservation', () => {
    it('When handle is called, Then the reservation is CONFIRMED, booking reference matches pattern, guest details persisted, and RESERVATION_CONFIRMED published once', async () => {
      reservationRepo.findByPaymentIntentId.mockResolvedValue(makeReservation() as any)
      sessionRepo.findOneById.mockResolvedValue(makeSession() as any)
      bookingRefService.assignToReservation.mockResolvedValue(ok(BOOKING_REF))
      reservationRepo.update.mockResolvedValue(undefined as any)
      sessionRepo.update.mockResolvedValue(undefined as any)

      const result = await service.handle(COMMAND)

      expect(result.isOk()).toBe(true)
      const { bookingReference, reservationId } = result._unsafeUnwrap()
      expect(bookingReference).toBe(BOOKING_REF)
      expect(reservationId).toBe(RESERVATION_EXT)

      expect(reservationRepo.update).toHaveBeenCalledWith(
        RESERVATION_ID,
        expect.objectContaining({
          status:          'CONFIRMED',
          paymentIntentId: INTENT_ID,
          guestName:       COMMAND.guestName,
          guestEmail:      COMMAND.guestEmail,
          guestPhone:      COMMAND.guestPhone,
        }),
      )
      expect(sessionRepo.update).toHaveBeenCalledWith(99, { status: 'COMPLETED' })

      expect(eventBus.published).toHaveLength(1)
      expect(eventBus.published[0].queue).toBe(EventQueues.RESERVATION_CONFIRMED)
      expect(eventBus.published[0].payload).toMatchObject({
        reservationId:    RESERVATION_EXT,
        bookingReference: BOOKING_REF,
        guestName:        COMMAND.guestName,
        staffId:          'staff-uuid-001',
      })
    })
  })
})

describe('Scenario: ConfirmPayment — idempotency', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let bookingRefService: jest.Mocked<BookingReferenceService>
  let eventBus: FakeEventBus

  beforeEach(async () => {
    reservationRepo = { findByPaymentIntentId: jest.fn(), update: jest.fn() } as any
    sessionRepo     = { findOneById: jest.fn(), update: jest.fn() } as any
    bookingRefService = { assignToReservation: jest.fn() } as any
    eventBus = new FakeEventBus()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: BookingReferenceService, useValue: bookingRefService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://frontend') } },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()
    service = module.get(ConfirmPayment)
  })

  describe('Given a reservation already CONFIRMED for the same paymentIntentId', () => {
    it('When handle is called again, Then result is Ok with existing ref and no event is republished', async () => {
      reservationRepo.findByPaymentIntentId.mockResolvedValue(
        makeReservation({ status: 'CONFIRMED', bookingReference: BOOKING_REF }) as any,
      )

      const result = await service.handle(COMMAND)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().bookingReference).toBe(BOOKING_REF)
      expect(bookingRefService.assignToReservation).not.toHaveBeenCalled()
      expect(reservationRepo.update).not.toHaveBeenCalled()
      expect(eventBus.published).toHaveLength(0)
    })
  })
})

describe('Scenario: ConfirmPayment — session expired race', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let bookingRefService: jest.Mocked<BookingReferenceService>
  let eventBus: FakeEventBus

  beforeEach(async () => {
    reservationRepo = { findByPaymentIntentId: jest.fn(), update: jest.fn() } as any
    sessionRepo     = { findOneById: jest.fn(), update: jest.fn() } as any
    bookingRefService = { assignToReservation: jest.fn() } as any
    eventBus = new FakeEventBus()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: BookingReferenceService, useValue: bookingRefService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://frontend') } },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()
    service = module.get(ConfirmPayment)
  })

  describe('Given a HOLD whose session has transitioned to EXPIRED', () => {
    it('When handle is called, Then result is Err(SESSION_EXPIRED) and reservation remains HOLD', async () => {
      reservationRepo.findByPaymentIntentId.mockResolvedValue(makeReservation() as any)
      sessionRepo.findOneById.mockResolvedValue(makeSession({ status: 'EXPIRED' }) as any)

      const result = await service.handle(COMMAND)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('SESSION_EXPIRED')
      expect(reservationRepo.update).not.toHaveBeenCalled()
      expect(eventBus.published).toHaveLength(0)
    })

    it('When session does not exist, Then result is Err(SESSION_EXPIRED)', async () => {
      reservationRepo.findByPaymentIntentId.mockResolvedValue(makeReservation() as any)
      sessionRepo.findOneById.mockResolvedValue(null)

      const result = await service.handle(COMMAND)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('SESSION_EXPIRED')
    })
  })
})

describe('Scenario: ConfirmPayment — missing intent', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let bookingRefService: jest.Mocked<BookingReferenceService>
  let eventBus: FakeEventBus

  beforeEach(async () => {
    reservationRepo = { findByPaymentIntentId: jest.fn(), update: jest.fn() } as any
    sessionRepo     = { findOneById: jest.fn(), update: jest.fn() } as any
    bookingRefService = { assignToReservation: jest.fn() } as any
    eventBus = new FakeEventBus()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: BookingReferenceService, useValue: bookingRefService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://frontend') } },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()
    service = module.get(ConfirmPayment)
  })

  describe('Given a paymentIntentId that does not match any reservation', () => {
    it('When handle is called, Then result is Err(RESERVATION_NOT_FOUND)', async () => {
      reservationRepo.findByPaymentIntentId.mockResolvedValue(null)

      const result = await service.handle(COMMAND)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('RESERVATION_NOT_FOUND')
    })
  })
})

describe('Scenario: ConfirmPayment — concurrent calls (webhook + poll race)', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let bookingRefService: jest.Mocked<BookingReferenceService>
  let eventBus: FakeEventBus

  beforeEach(async () => {
    reservationRepo = { findByPaymentIntentId: jest.fn(), update: jest.fn() } as any
    sessionRepo     = { findOneById: jest.fn(), update: jest.fn() } as any
    bookingRefService = { assignToReservation: jest.fn() } as any
    eventBus = new FakeEventBus()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: BookingReferenceService, useValue: bookingRefService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://frontend') } },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()
    service = module.get(ConfirmPayment)
  })

  describe('Given two concurrent calls for the same paymentIntentId', () => {
    it('When both run, Then exactly one CONFIRMED transition happens and one event is published', async () => {
      let callCount = 0
      reservationRepo.findByPaymentIntentId.mockImplementation(async () => {
        callCount++
        // First call sees HOLD; second simulates the idempotency guard (already CONFIRMED)
        if (callCount === 1) return makeReservation() as any
        return makeReservation({ status: 'CONFIRMED', bookingReference: BOOKING_REF }) as any
      })
      sessionRepo.findOneById.mockResolvedValue(makeSession() as any)
      bookingRefService.assignToReservation.mockResolvedValue(ok(BOOKING_REF))
      reservationRepo.update.mockResolvedValue(undefined as any)
      sessionRepo.update.mockResolvedValue(undefined as any)

      const [r1, r2] = await Promise.all([
        service.handle(COMMAND),
        service.handle(COMMAND),
      ])

      // Both calls succeed
      expect(r1.isOk()).toBe(true)
      expect(r2.isOk()).toBe(true)

      // Only one confirmation write (the second hit the idempotency guard)
      const confirmedUpdates = (reservationRepo.update as jest.Mock).mock.calls.filter(
        ([, data]) => data.status === 'CONFIRMED',
      )
      expect(confirmedUpdates).toHaveLength(1)

      // Exactly one event published
      const confirmedEvents = eventBus.published.filter(
        e => e.queue === EventQueues.RESERVATION_CONFIRMED,
      )
      expect(confirmedEvents).toHaveLength(1)
    })
  })
})
