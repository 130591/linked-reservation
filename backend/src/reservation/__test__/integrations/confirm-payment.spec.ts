import { Test, TestingModule } from '@nestjs/testing'
import { ConfirmPayment } from '@/reservation/core/service'
import { ReservationRepository, ReservationSessionRepository } from '@/reservation/persist'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { initializeTransactionalContext } from 'typeorm-transactional'

import { FakeEventBus } from '@/reservation/__test__/fixture/events'
import { EVENT_BUS } from '@/common/messaging'

import { ConfigService } from '@/common/config'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
}))

describe('Scenario: Reservation Payment Confirmation', () => {
  let service: ConfirmPayment
  let reservationRepo: jest.Mocked<ReservationRepository>
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  let eventBus: FakeEventBus
  let configService: jest.Mocked<ConfigService>

  beforeEach(async () => {
    reservationRepo = {
      findOneById: jest.fn(),
      save: jest.fn(),
    } as any
    sessionRepo = {
      findOneById: jest.fn(),
      save: jest.fn(),
    } as any
    eventBus = new FakeEventBus()
    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000')
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPayment,
        {
          provide: ReservationRepository,
          useValue: reservationRepo,
        },
        {
          provide: ReservationSessionRepository,
          useValue: sessionRepo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: EVENT_BUS,
          useValue: eventBus,
        }
      ],
    }).compile()

    service = module.get<ConfirmPayment>(ConfirmPayment)
  })

  describe('Given that a reservation is awaiting payment (HOLD status)', () => {
    const reservationId = 'res-123'
    const sessionId = 'ses-456'

    it('When the payment is confirmed before expiration, then the reservation must be marked as CONFIRMED', async () => {
      const reservation = {
        id: reservationId,
        sessionId: sessionId,
        roomId: 'room-1',
        checkIn: new Date('2026-10-10'),
        checkOut: new Date('2026-10-15'),
        status: 'HOLD',
        expiresAt: new Date(Date.now() + 1000 * 60 * 5), // Expires in 5 min
      } as any
      const session = { 
        id: sessionId, 
        status: 'ACTIVE',
        stayId: 'hotel-123',
        stayName: 'Grand Hotel',
        guests: 2,
        customer: { name: 'John Doe', phone: '123456789' }
      } as any

      reservationRepo.findOneById.mockResolvedValue(reservation)
      sessionRepo.findOneById.mockResolvedValue(session)

      await service.handle({ reservationId, paymentId: 'pay-789' })

      expect(reservation.status).toBe('CONFIRMED')
      expect(session.status).toBe('COMPLETED')
      expect(reservationRepo.save).toHaveBeenCalled()
      expect(sessionRepo.save).toHaveBeenCalled()

      expect(eventBus.published).toHaveLength(1)
      expect(eventBus.published[0].payload).toEqual(expect.objectContaining({
        reservationId,
        stayName: 'Grand Hotel',
        bookingLink: 'http://localhost:3000/reservation/res-123'
      }))
    })

    it('When the payment is confirmed after the HOLD expiration, then the reservation must be expired and payment rejected', async () => {
      const reservation = {
        id: reservationId,
        sessionId: sessionId,
        status: 'HOLD',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      } as any

      reservationRepo.findOneById.mockResolvedValue(reservation)

      await expect(service.handle({ reservationId, paymentId: 'pay-789' }))
        .rejects.toThrow(new BadRequestException('Reservation HOLD has expired'))

      expect(reservation.status).toBe('EXPIRED')
      expect(reservationRepo.save).toHaveBeenCalled()
    })
  })

  describe('Given that a confirmation attempt is made for an invalid reservation', () => {
    it('When the reservation does not exist in the system, then it should return a not found error', async () => {
      reservationRepo.findOneById.mockResolvedValue(null)

      await expect(service.handle({ reservationId: 'non-existent', paymentId: 'pay-789' }))
        .rejects.toThrow(NotFoundException)
    })

    it('When the reservation is already CONFIRMED or CANCELLED, then it should not allow new confirmation', async () => {
      const reservation = { id: 'res-123', status: 'CONFIRMED' } as any
      reservationRepo.findOneById.mockResolvedValue(reservation)

      await expect(service.handle({ reservationId: 'res-123', paymentId: 'pay-789' }))
        .rejects.toThrow(BadRequestException)
    })
  })
})
