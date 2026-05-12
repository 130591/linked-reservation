import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { ok, err, Result } from 'neverthrow'
import { QueryFailedError } from 'typeorm'
import { formatYYMM } from '@/conversation/libs/dates-validator'
import { DomainError } from '@/common/exceptions'
import { ReservationRepository } from '@/reservation/persist'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const SUFFIX_LENGTH = 5
const MAX_RETRIES = 3
// Rejection sampling threshold to avoid modulo bias
const SAMPLE_THRESHOLD = Math.floor(256 / ALPHABET.length) * ALPHABET.length

function generateSuffix(): string {
  const chars: string[] = []
  while (chars.length < SUFFIX_LENGTH) {
    const buf = randomBytes(SUFFIX_LENGTH * 2)
    for (let i = 0; i < buf.length && chars.length < SUFFIX_LENGTH; i++) {
      const byte = buf[i]
      if (byte < SAMPLE_THRESHOLD) {
        chars.push(ALPHABET[byte % ALPHABET.length])
      }
    }
  }
  return chars.join('')
}

@Injectable()
export class BookingReferenceService {
  constructor(private readonly reservationRepo: ReservationRepository) {}

  generate(): string {
    return `LR-${formatYYMM(new Date())}-${generateSuffix()}`
  }

  async assignToReservation(
    reservationId: number,
  ): Promise<Result<string, DomainError>> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const ref = this.generate()
      try {
        await this.reservationRepo.update(reservationId, { bookingReference: ref })
        return ok(ref)
      } catch (error) {
        const isCollision =
          error instanceof QueryFailedError && (error as any).code === '23505'
        if (!isCollision) throw error
      }
    }
    return err(DomainError.BOOKING_REFERENCE_COLLISION_EXHAUSTED())
  }
}
