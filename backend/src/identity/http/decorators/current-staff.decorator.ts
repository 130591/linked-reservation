import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'

export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): IdentityStaffMemberEntity => {
    return ctx.switchToHttp().getRequest()['staff']
  },
)
