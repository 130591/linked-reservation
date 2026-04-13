import { Injectable } from '@nestjs/common'
import { Result } from 'neverthrow'
import { GenerateLink, GenerateLinkError, GenerateLinkResult } from '../core/service'
import { GenerateLinkCommand } from '../http/dto/generate-link'
import { StayRepository } from '../persist/repositories/stay.repository'
import { StaffMemberRepository } from '../persist/repositories/staff-member.repository'

@Injectable()
export class ReservationAPI {
  constructor(
    private readonly generateLink: GenerateLink,
    private readonly stayRepo: StayRepository,
    private readonly staffMemberRepo: StaffMemberRepository,
  ) { }

  async generate(command: GenerateLinkCommand): Promise<Result<GenerateLinkResult, GenerateLinkError>> {
    return await this.generateLink.handle({
      checkIn: new Date(command.checkIn),
      checkOut: new Date(command.checkOut),
      guests: command.guests,
      staffId: command.staffId,
      stayId: command.stayId,
      stayName: command.stayName,
      customerName: command.customerName
    })
  }

  async findWhatsAppNumber(stayId: string): Promise<string | null> {
    const stay = await this.stayRepo.findOneById(stayId)
    return stay?.whatsappNumber ?? null
  }

  async findBotStaffId(stayId: string): Promise<string | null> {
    const bot = await this.staffMemberRepo.findBot(stayId)
    return bot?.externalId ?? null
  }
}