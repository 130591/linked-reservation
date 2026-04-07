import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator'
import { PropertyType } from '@/identity/persist/entities/property'

export class CreatePropertyDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEnum(['hotel', 'pousada', 'hostel', 'other'] as const)
  type: PropertyType

  @IsEmail()
  adminEmail: string

  @IsString()
  @MinLength(2)
  adminName: string
}
