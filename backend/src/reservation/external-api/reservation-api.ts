import { Result } from 'neverthrow'
import { GenerateLink, GenerateLinkError, GenerateLinkResult } from '../core/service'
import { GenerateLinkCommand } from '../http/dto/generate-link'

export class ReservationAPI {
  constructor(private readonly generateLink: GenerateLink) { }

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
}