import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { IsNull } from 'typeorm'
import { Transactional } from 'typeorm-transactional'
import { isExclusionConstraintError } from '@/common/database'
import {
  ReservationRepository,
  ReservationSessionRepository,
  ReservationSessionEntity,
  ReservationEntity,
  RoomRepository
} from '@/reservation/persist'

export interface SelectRoomCommand {
  sessionId: string
  roomId: string
}

export interface SelectRoomResult {
  reservationId: string
  roomId: string
  sessionId: string
  expiresAt: Date
}

@Injectable()
export class SelectRoom {
  constructor(
    private readonly sessionRepo: ReservationSessionRepository,
    private readonly reservationRepo: ReservationRepository,
    private readonly roomRepo: RoomRepository
  ) { }

  async update(id: string, data: Partial<ReservationEntity>): Promise<void> {
    await this.reservationRepo.update(id, data as any)
  }

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
  async handle(command: SelectRoomCommand): Promise<SelectRoomResult> {
    const session = await this.sessionRepo.findOneById(command.sessionId)
    if (!session || session.isExpired()) {
      throw new BadRequestException('Session expired or invalid')
    }

    const room = await this.roomRepo.findOneBy({
      id: command.roomId,
      hotelId: session.hotelId
    })

    if (!room) {
      throw new NotFoundException('Room not found for this session')
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
        return {
          reservationId: existingHold.id,
          roomId: existingHold.roomId,
          sessionId: session.id,
          expiresAt: existingHold.expiresAt
        }
      }

      await this.reservationRepo.update(existingHold.id, {
        deletedAt: new Date()
      })
    }

    try {
      const hold = await this.reservationRepo.save(
        this.createHold(session, command.roomId)
      )

      return {
        reservationId: hold.id,
        roomId: hold.roomId,
        sessionId: session.id,
        expiresAt: hold.expiresAt
      }
    } catch (err) {
      if (isExclusionConstraintError(err)) {
        throw new ConflictException('Room is no longer available')
      }
      throw err
    }
  }
}