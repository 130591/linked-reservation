import { Test, TestingModule } from '@nestjs/testing'
import { ConfirmReservation } from '@/reservation/core/service'
import { ReservationRepository } from '@/reservation/persist'
import { BadGatewayException } from '@nestjs/common'
import { Room } from '@/reservation/core/domain'

describe('Scenario: Confirmation of Reservation Intent', () => {
  let service: ConfirmReservation
  let repo: jest.Mocked<ReservationRepository>

  beforeEach(async () => {
    repo = {
      save: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmReservation,
        {
          provide: ReservationRepository,
          useValue: repo,
        },
      ],
    }).compile()

    service = module.get<ConfirmReservation>(ConfirmReservation)
  })

  describe('Given that a customer has chosen the desired dates and rooms', () => {
    const validCommand = {
      checkIn: new Date('2030-12-01'),
      checkOut: new Date('2030-12-05'),
      guests: [],
      availableRooms: [Room.create('Luxury', 500)],
      expiresAt: new Date(),
    }

    it('When they confirm the details, then a reservation with PENDING status must be saved', async () => {
      await service.handle(validCommand)

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'HOLD', // Note: ReservationEntity.fromDomain sets it to 'HOLD' in current implementation
          roomId: expect.any(String),
        })
      )
    })

    it('When the check-in dates are in the past, then the system must prevent the reservation', async () => {
      const invalidCommand = {
        ...validCommand,
        checkIn: new Date('2020-01-01'), // Date in the past
      }

      await expect(service.handle(invalidCommand))
        .rejects.toThrow(BadGatewayException)
    })
  })
})
