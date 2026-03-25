import { IsString, IsObject, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class MessageMetadataDto {
  @IsString()
  stayId: string
}

export class InboundMessageDto {
  @IsString()
  messageId: string

  @IsString()
  from: string

  @IsString()
  body: string

  @IsObject()
  @ValidateNested()
  @Type(() => MessageMetadataDto)
  metadata: MessageMetadataDto
}