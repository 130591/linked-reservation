import { Test, TestingModule } from '@nestjs/testing'
import { QueryFailedError } from 'typeorm'
import { BookingReferenceService } from '@/reservation/core/service/booking-reference'
import { ReservationRepository } from '@/reservation/persist'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: any, _key: any, descriptor: any) => descriptor,
}))

const REFERENCE_REGEX = /^LR-\d{4}-[2-9A-HJKMNP-Z]{5}$/
const EXCLUDED_CHARS = new Set(['0', '1', 'I', 'L', 'O', 'U'])

const makeRepo = (): jest.Mocked<ReservationRepository> =>
  ({ update: jest.fn() } as any)

describe('Scenario: BookingReferenceService — reference generation', () => {
  let service: BookingReferenceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingReferenceService,
        { provide: ReservationRepository, useValue: makeRepo() },
      ],
    }).compile()
    service = module.get(BookingReferenceService)
  })

  describe('Given the current date is known', () => {
    it('When generate() is called, Then the result matches LR-YYMM-XXXXX', () => {
      expect(service.generate()).toMatch(REFERENCE_REGEX)
    })

    it('When generate() is called 10,000 times, Then no excluded characters appear in the suffix', () => {
      for (let i = 0; i < 10_000; i++) {
        const suffix = service.generate().slice(-5)
        for (const ch of suffix) {
          expect(EXCLUDED_CHARS.has(ch)).toBe(false)
        }
      }
    })

    it('When generate() is called 100 times, Then all results are unique (entropy check)', () => {
      const seen = new Set<string>()
      for (let i = 0; i < 100; i++) seen.add(service.generate())
      expect(seen.size).toBe(100)
    })

    it('When generate() is called, Then the YYMM segment matches the current date', () => {
      const now = new Date()
      const yy = String(now.getFullYear()).slice(-2)
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      expect(service.generate()).toContain(`LR-${yy}${mm}-`)
    })
  })
})

describe('Scenario: BookingReferenceService — assignToReservation', () => {
  let service: BookingReferenceService
  let repo: jest.Mocked<ReservationRepository>

  beforeEach(async () => {
    repo = makeRepo()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingReferenceService,
        { provide: ReservationRepository, useValue: repo },
      ],
    }).compile()
    service = module.get(BookingReferenceService)
  })

  describe('Given a reservation with a free booking reference slot', () => {
    it('When assignToReservation succeeds on the first attempt, Then result is Ok with the reference', async () => {
      repo.update.mockResolvedValueOnce(undefined as any)

      const result = await service.assignToReservation(42)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toMatch(REFERENCE_REGEX)
      expect(repo.update).toHaveBeenCalledTimes(1)
      expect(repo.update).toHaveBeenCalledWith(42, expect.objectContaining({ bookingReference: expect.any(String) }))
    })
  })

  describe('Given the first two references collide but the third succeeds', () => {
    it('When assignToReservation is called, Then result is Ok and the repository was called exactly three times', async () => {
      const collision = makeUniqueViolation()
      repo.update
        .mockRejectedValueOnce(collision)
        .mockRejectedValueOnce(collision)
        .mockResolvedValueOnce(undefined as any)

      const result = await service.assignToReservation(42)

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toMatch(REFERENCE_REGEX)
      expect(repo.update).toHaveBeenCalledTimes(3)
    })
  })

  describe('Given all three attempts collide', () => {
    it('When assignToReservation is called, Then result is Err(BOOKING_REFERENCE_COLLISION_EXHAUSTED)', async () => {
      repo.update.mockRejectedValue(makeUniqueViolation())

      const result = await service.assignToReservation(42)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('BOOKING_REFERENCE_COLLISION_EXHAUSTED')
    })
  })

  describe('Given the repository raises a non-23505 error', () => {
    it('When assignToReservation is called, Then the error is propagated without retry', async () => {
      repo.update.mockRejectedValueOnce(new Error('connection lost'))

      await expect(service.assignToReservation(42)).rejects.toThrow('connection lost')
      expect(repo.update).toHaveBeenCalledTimes(1)
    })
  })
})

function makeUniqueViolation(): QueryFailedError {
  const e = new QueryFailedError('INSERT ...', [], new Error('unique violation'))
  ;(e as any).code = '23505'
  return e
}
