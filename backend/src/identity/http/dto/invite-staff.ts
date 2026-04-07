import { IsEmail, IsString, MinLength } from 'class-validator'

export class InviteStaffDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(2)
  name: string
}
