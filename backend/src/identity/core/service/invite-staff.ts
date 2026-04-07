import { Inject, Injectable, Logger } from '@nestjs/common'
import { ManagementClient } from 'auth0'
import { err, ok, Result } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { IdentityRole } from '@/identity/persist'
import { AUTH0_MANAGEMENT } from '@/identity/core/contract'

export interface InviteStaffCommand {
  inviterRole: IdentityRole
  inviterPropertyId: string
  email: string
  name: string
}

export interface InviteStaffResult {
  auth0UserId: string
}

@Injectable()
export class InviteStaffService {
  private readonly logger = new Logger(InviteStaffService.name)
  
  constructor(
    @Inject(AUTH0_MANAGEMENT) private readonly auth0: ManagementClient,
  ) {}

  async handle(command: InviteStaffCommand): Promise<Result<InviteStaffResult, DomainError>> {
    if (command.inviterRole !== 'property_admin') {
      return err(DomainError.STAFF_NOT_AUTHORIZED())
    }

    let auth0UserId: string
    try {
      const user = await this.auth0.users.create({
        email: command.email,
        name: command.name,
        connection: 'Username-Password-Authentication',
        app_metadata: {
          propertyId: command.inviterPropertyId,
          role: 'staff',
        },
      })
      auth0UserId = user.data.user_id!
    } catch (error) {
      this.logger.error('Failed to invite staff', error)
      return err(DomainError.STAFF_INVITATION_FAILED())
    }

    return ok({ auth0UserId })
  }
}
