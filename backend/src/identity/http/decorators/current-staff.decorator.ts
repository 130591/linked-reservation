import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { IdentityRole } from '@/identity/persist/entities/identity-staff-member'

export interface StaffContext {
  id:         string
  role:       IdentityRole
  propertyId: string
}

export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): StaffContext => {
    return ctx.switchToHttp().getRequest()['staff']
  },
)
