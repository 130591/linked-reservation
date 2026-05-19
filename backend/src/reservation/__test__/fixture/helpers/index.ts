import { ReservationEntity } from '@/reservation/persist'
import { ReservationSessionEntity } from '@/reservation/persist'

export function buildMessage(body: object) {
  return { Body: JSON.stringify(body) } as any
}

export function buildSession(overrides: Partial<ReservationSessionEntity> & { externalId: string }): ReservationSessionEntity {
  return new ReservationSessionEntity({
    id: 1,
    stayId: 'hotel-1',
    stayName: 'Grand Hotel',
    checkIn: new Date('2030-06-01'),
    checkOut: new Date('2030-06-05'),
    guests: 2,
    staffId: 'staff-1',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    customer: null,
    version: 1,
    ...overrides,
  })
}

export function buildReservation(overrides: Partial<ReservationEntity> & { externalId: string; sessionId: number }): ReservationEntity {
  return new ReservationEntity({
    roomId: 1,
    checkIn: new Date('2030-06-01'),
    checkOut: new Date('2030-06-05'),
    status: 'HOLD',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    deletedAt: null,
    ...overrides,
  })
}