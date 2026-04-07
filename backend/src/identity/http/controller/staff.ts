import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { Auth0JwtGuard } from '@/identity/http/guards/auth0-jwt.guard'
import { CurrentStaff } from '@/identity/http/decorators/current-staff.decorator'
import { InviteStaffService } from '@/identity/core/service/invite-staff'
import { InviteStaffDto } from '@/identity/http/dto/invite-staff'
import { StaffContext } from '@/identity/http/decorators/current-staff.decorator'

@Controller('staff')
export class StaffController {
  constructor(private readonly inviteStaff: InviteStaffService) {}

  @UseGuards(Auth0JwtGuard)
  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @CurrentStaff() staff: StaffContext,
    @Body() dto: InviteStaffDto,
  ) {
    const result = await this.inviteStaff.handle({
      inviterRole: staff.role,
      inviterPropertyId: staff.propertyId,
      email: dto.email,
      name: dto.name,
    })

    if (result.isErr()) throw result.error
    return result.value
  }
}
