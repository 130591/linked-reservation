import { Injectable } from '@nestjs/common'
import { IsNull } from 'typeorm'
import { Transactional } from 'typeorm-transactional'
import { err, ok, Result } from 'neverthrow'
import { isExclusionConstraintError } from '@/common/database'
import { DomainError } from '@/common/exceptions'
import {
  ReservationRepository,
  ReservationSessionRepository,
  ReservationSessionEntity,
  ReservationEntity,
  RoomRepository
} from '@/reservation/persist'
import { SelectRoomCommand } from '@/reservation/http/dto'

export interface SelectRoomResult {
  reservationId: string
  roomId: string
  sessionId: string
  expiresAt: Date
}

type SelectRoomError = ReturnType<
  typeof DomainError.SESSION_EXPIRED
  | typeof DomainError.ROOM_NOT_FOUND
  | typeof DomainError.ROOM_NOT_AVAILABLE
>

@Injectable()
export class SelectRoom {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly reservationRepo: ReservationRepository,
    private readonly roomRepo: RoomRepository
  ) { }

  private createHold(
    session: ReservationSessionEntity,
    roomId: string
  ): ReservationEntity {
    return new ReservationEntity({
      roomId,
      sessionId: session.id,
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      status: 'HOLD',
      expiresAt: new Date(session.expiresAt),
      deletedAt: null
    })
  }

  @Transactional()
  async handle(command: SelectRoomCommand): Promise<Result<SelectRoomResult, SelectRoomError>> {
    const session = await this.sessionRepo.findOneById(command.sessionId)
    if (!session || session.isExpired()) {
      return err(DomainError.SESSION_EXPIRED())
    }

    const room = await this.roomRepo.findOneBy({
      id: command.roomId,
      stayId: session.stayId
    })

    if (!room) {
      return err(DomainError.ROOM_NOT_FOUND())
    }

    const existingHold = await this.reservationRepo.findOne({
      where: {
        sessionId: session.id,
        status: 'HOLD',
        deletedAt: IsNull()
      }
    })

    if (existingHold) {
      if (existingHold.roomId === command.roomId) {
        return ok({
          reservationId: existingHold.id,
          roomId: existingHold.roomId,
          sessionId: session.id,
          expiresAt: existingHold.expiresAt
        })
      }

      await this.reservationRepo.update(existingHold.id, {
        deletedAt: new Date()
      })
    }

    try {
      const hold = await this.reservationRepo.save(
        this.createHold(session, command.roomId)
      )

      return ok({
        reservationId: hold.id,
        roomId: hold.roomId,
        sessionId: session.id,
        expiresAt: hold.expiresAt
      })
    } catch (error) {
      if (isExclusionConstraintError(error)) {
        return err(DomainError.ROOM_NOT_AVAILABLE())
      }
      throw error
    }
  }
}