import { Module } from '@nestjs/common'
import { ManagementClient } from 'auth0'
import { ConfigService } from '@/common/config'
import { EVENT_BUS, SqsEventBus } from '@/common/messaging'
import { IdentityPersistenceModule } from './persist/persistence.module'
import { PropertyRepository } from './persist/repositories/property.repository'
import { IdentityStaffMemberRepository } from './persist/repositories/identity-staff-member.repository'
import { AdminController } from './http/controller/admin'
import { StaffController } from './http/controller/staff'
import { Auth0JwtGuard } from './http/guards/auth0-jwt.guard'
import { SystemAdminGuard } from './http/guards/system-admin.guard'
import { ProvisionPropertyService } from './core/service/provision-property'
import { InviteStaffService } from './core/service/invite-staff'
import { AUTH0_MANAGEMENT } from './core/contract/identity-token'
import { IdentityAPI } from './external-api/identity-api'
import { TrialExpirationJob } from './jobs/trial-expiration.job'

@Module({
  imports: [IdentityPersistenceModule],
  controllers: [AdminController, StaffController],
  providers: [
    ProvisionPropertyService,
    InviteStaffService,
    Auth0JwtGuard,
    SystemAdminGuard,
    TrialExpirationJob,
    IdentityAPI,
    PropertyRepository,
    IdentityStaffMemberRepository,
    {
      provide: EVENT_BUS,
      useClass: SqsEventBus,
    },
    {
      provide: AUTH0_MANAGEMENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new ManagementClient({
          domain: config.get('auth0Domain'),
          clientId: config.get('auth0ManagementClientId'),
          clientSecret: config.get('auth0ManagementClientSecret'),
        }),
    },
  ],
  exports: [IdentityAPI, Auth0JwtGuard],
})
export class IdentityModule {}
