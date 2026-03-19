import { Test, TestingModule } from '@nestjs/testing'
import { SelectRoom } from '@/reservation/core/service'
import {
  ReservationRepository,
  ReservationSessionRepository,
  RoomRepository
} from '@/reservation/persist'
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common'

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
      reservationRepo.findOne.mockResolvedValue(null) // No previous hold
      reservationRepo.save.mockResolvedValue({ id: 'res-789', roomId, expiresAt: session.expiresAt } as any)

      const result = await service.handle({ sessionId, roomId })

      expect(reservationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'HOLD',
          roomId,
          sessionId,
        })
      )
      expect(result.reservationId).toBe('res-789')
    })

    it('When they change their selected room, then the previous HOLD must be marked as deleted and a new one created', async () => {
      const oldRoomId = 'room-old'
      const existingHold = { id: 'res-old', roomId: oldRoomId, sessionId } as any

      sessionRepo.findOneById.mockResolvedValue(session)
      roomRepo.findOneBy.mockResolvedValue({ id: roomId, hotelId } as any)
      reservationRepo.findOne.mockResolvedValue(existingHold)
      reservationRepo.save.mockResolvedValue({ id: 'res-new', roomId, expiresAt: session.expiresAt } as any)

      await service.handle({ sessionId, roomId })

      // Should soft delete the old one
      expect(reservationRepo.update).toHaveBeenCalledWith('res-old', {
        deletedAt: expect.any(Date)
      })
      // Should create the new hold
      expect(reservationRepo.save).toHaveBeenCalled()
    })

    it('When they select a room that is already taken (Exclusion constraint), then a conflict error must be thrown', async () => {
      const { QueryFailedError } = require('typeorm')

      sessionRepo.findOneById.mockResolvedValue(session)
      roomRepo.findOneBy.mockResolvedValue({ id: roomId, hotelId } as any)
      reservationRepo.findOne.mockResolvedValue(null)

      const exclusionError = new QueryFailedError('query', [], { message: 'exclusion constraint' })
        ; (exclusionError as any).code = '23P01' // PostgreSQL exclusion constraint error code
      reservationRepo.save.mockRejectedValue(exclusionError)

      await expect(service.handle({ sessionId, roomId }))
        .rejects.toThrow(ConflictException)
    })
  })

  describe('Given an invalid or expired environment', () => {
    it('When the session is expired, then it should prevent room selection', async () => {
      sessionRepo.findOneById.mockResolvedValue({
        isExpired: () => true
      } as any)

      await expect(service.handle({ sessionId: 'exp', roomId: 'any' }))
        .rejects.toThrow(BadRequestException)
    })

    it('When the room does not belong to the session hotel, then it should return not found', async () => {
      sessionRepo.findOneById.mockResolvedValue({
        id: 'ses', hotelId: 'h1', isExpired: () => false
      } as any)
      roomRepo.findOneBy.mockResolvedValue(null) // Room not found for hotel h1

      await expect(service.handle({ sessionId: 'ses', roomId: 'room-h2' }))
        .rejects.toThrow(NotFoundException)
    })
  })
})
