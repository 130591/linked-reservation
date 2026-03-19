import { Test, TestingModule } from '@nestjs/testing'
import { GenerateLink, ReservationTokenService } from '@/reservation/core/service'
import { ReservationSessionRepository } from '@/reservation/persist'
import { ConfigService } from '@/common/config'
import { createHmac } from 'crypto'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
}))

describe('Scenario: Generate Reservation Link by a Staff Member', () => {
  let service: GenerateLink
  let sessionRepo: jest.Mocked<ReservationSessionRepository>
  const SECRET = 'test-secret-with-at-least-32-characters'

  beforeEach(async () => {
    sessionRepo = {
      save: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateLink,
        ReservationTokenService,
        {
          provide: ReservationSessionRepository,
          useValue: sessionRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(SECRET),
          },
        },
      ],
    }).compile()

    service = module.get<GenerateLink>(GenerateLink)
  })

  describe('Given that a staff member wants to send a reservation link to a customer', () => {
    const command = {
      hotelId: 'hotel-uuid',
      checkIn: new Date('2030-12-01'),
      checkOut: new Date('2030-12-05'),
      guests: 2,
      staffId: 'staff-uuid',
    }

    it('When they request the link generation, then the system must create a new active session in the database', async () => {
      sessionRepo.save.mockResolvedValue({
        id: 'session-uuid',
        expiresAt: new Date(),
      } as any)

      await service.handle(command)

      expect(sessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hotelId: command.hotelId,
          status: 'ACTIVE',
          guests: command.guests,
          version: 1,
        })
      )
    })

    it('And the system must return a signed token (HMAC) containing the session ID to ensure integrity', async () => {
      const sessionId = 'session-uuid'
      sessionRepo.save.mockResolvedValue({
        id: sessionId,
        expiresAt: new Date(),
      } as any)

      const result = await service.handle(command)

      if (result.isErr()) throw result.error

      // Verify token format: payload.sig (base64url)
      const [payload, sig] = result.value.token.split('.')
      expect(payload).toBeDefined()
      expect(sig).toBeDefined()

      // Validate signature manually to ensure service used the correct secret
      const expectedSig = createHmac('sha256', SECRET)
        .update(payload)
        .digest('base64url')

      expect(sig).toBe(expectedSig)
      expect(Buffer.from(payload, 'base64url').toString()).toBe(sessionId)
    })

    it('And the generated session must have an expiration of exactly 15 minutes from creation', async () => {
      // Mock to capture the object sent to save
      let savedSession: any
      sessionRepo.save.mockImplementation(async (session) => {
        savedSession = session
        return { ...session, id: '123' } as any
      })

      const now = new Date()
      jest.useFakeTimers().setSystemTime(now)

      await service.handle(command)

      const fifteenMinutes = 15 * 60 * 1000
      const expectedExpiration = new Date(now.getTime() + fifteenMinutes)
      expect(savedSession.expiresAt.getTime()).toBe(expectedExpiration.getTime())

      jest.useRealTimers()
    })
  })
})