import { Module } from '@nestjs/common'
import { ReservationPersistenceModule } from '@/reservation/persist/persistence.module'
import { PropertyRepository } from './repositories/property.repository'
import { IdentityStaffMemberRepository } from './repositories/identity-staff-member.repository'

const repositories = [PropertyRepository, IdentityStaffMemberRepository]

@Module({
  imports: [ReservationPersistenceModule],
  providers: [...repositories],
  exports: [...repositories],
})
export class IdentityPersistenceModule {}
