import { ReservationEntity } from '@/reservation/persist'
import { ReservationSessionEntity } from '@/reservation/persist'

export function buildMessage(body: object) {
  return { Body: JSON.stringify(body) } as any
}

export function buildSession(overrides: Partial<ReservationSessionEntity> & { id: string }): ReservationSessionEntity {
  return new ReservationSessionEntity({
    hotelId: 'hotel-1',
    hotelName: 'Grand Hotel',
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

export function buildReservation(overrides: Partial<ReservationEntity> & { id: string; sessionId: string }): ReservationEntity {
  return new ReservationEntity({
    roomId: 'room-1',
    checkIn: new Date('2030-06-01'),
    checkOut: new Date('2030-06-05'),
    status: 'HOLD',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    deletedAt: null,
    ...overrides,
  })
}