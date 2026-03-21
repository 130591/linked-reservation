import { Test, TestingModule } from '@nestjs/testing'
import { SelectRoom } from '@/reservation/core/service'
import {
  ReservationRepository,
  ReservationSessionRepository,
  RoomRepository
} from '@/reservation/persist'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
}))

describe('Scenario: Room Selection in a Reservation Session', () => {
  let service: SelectRoom
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let reservationRepo: jest.Mocked<ReservationRepository>
  let roomRepo: jest.Mocked<RoomRepository>

  beforeEach(async () => {
    sessionRepo = {
      findOneById: jest.fn(),
    } as any
    reservationRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any
    roomRepo = {
      findOneBy: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelectRoom,
        { provide: ReservationSessionRepository, useValue: sessionRepo },
        { provide: ReservationRepository, useValue: reservationRepo },
        { provide: RoomRepository, useValue: roomRepo },
      ],
    }).compile()

    service = module.get<SelectRoom>(SelectRoom)
  })

  describe('Given a customer is browsing available rooms with an active session', () => {
    const sessionId = 'ses-123'
    const roomId = 'room-abc'
    const hotelId = 'hotel-456'

    const session = {
      id: sessionId,
      hotelId,
      checkIn: new Date('2030-10-01'),
      checkOut: new Date('2030-10-05'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      isExpired: () => false,
    } as any

    it('When they select a valid room for the first time, then a HOLD reservation must be created', async () => {
      sessionRepo.findOneById.mockResolvedValue(session)
      roomRepo.findOneBy.mockResolvedValue({ id: roomId, hotelId } as any)
      reservationRepo.findOne.mockResolvedValue(null)
      reservationRepo.save.mockResolvedValue({ id: 'res-789', roomId, expiresAt: session.expiresAt } as any)

      const result = await service.handle({ sessionId, roomId })

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.reservationId).toBe('res-789')
        expect(result.value.roomId).toBe(roomId)
      }
    })

    it('When they change their selected room, then the previous HOLD must be marked as deleted and a new one created', async () => {
      const oldRoomId = 'room-old'
      const existingHold = { id: 'res-old', roomId: oldRoomId, sessionId } as any

      sessionRepo.findOneById.mockResolvedValue(session)
      roomRepo.findOneBy.mockResolvedValue({ id: roomId, hotelId } as any)
      reservationRepo.findOne.mockResolvedValue(existingHold)
      reservationRepo.save.mockResolvedValue({ id: 'res-new', roomId, expiresAt: session.expiresAt } as any)

      const result = await service.handle({ sessionId, roomId })

      expect(result.isOk()).toBe(true)
      expect(reservationRepo.update).toHaveBeenCalledWith('res-old', {
        deletedAt: expect.any(Date)
      })
      expect(reservationRepo.save).toHaveBeenCalled()
    })

    it('When they select a room that is already taken (Exclusion constraint), then the result must contain ROOM_NOT_AVAILABLE', async () => {
      const { QueryFailedError } = require('typeorm')

      sessionRepo.findOneById.mockResolvedValue(session)
      roomRepo.findOneBy.mockResolvedValue({ id: roomId, hotelId } as any)
      reservationRepo.findOne.mockResolvedValue(null)

      const exclusionError = new QueryFailedError('query', [], { message: 'exclusion constraint' })
        ; (exclusionError as any).code = '23P01'
      reservationRepo.save.mockRejectedValue(exclusionError)

      const result = await service.handle({ sessionId, roomId })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('ROOM_NOT_AVAILABLE')
      }
    })
  })

  describe('Given an invalid or expired environment', () => {
    it('When the session is expired, then the result must contain SESSION_EXPIRED', async () => {
      sessionRepo.findOneById.mockResolvedValue({
        isExpired: () => true
      } as any)

      const result = await service.handle({ sessionId: 'exp', roomId: 'any' })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('SESSION_EXPIRED')
      }
    })

    it('When the room does not belong to the session hotel, then the result must contain ROOM_NOT_FOUND', async () => {
      sessionRepo.findOneById.mockResolvedValue({
        id: 'ses', hotelId: 'h1', isExpired: () => false
      } as any)
      roomRepo.findOneBy.mockResolvedValue(null)

      const result = await service.handle({ sessionId: 'ses', roomId: 'room-h2' })

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('ROOM_NOT_FOUND')
      }
    })
  })
})
