import { Injectable } from '@nestjs/common'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { IdentityStaffMemberRepository } from '@/identity/persist/repositories/identity-staff-member.repository'
import { PropertyEntity } from '@/identity/persist/entities/property'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'

@Injectable()
export class IdentityAPI {
  constructor(
    private readonly staffRepo: IdentityStaffMemberRepository,
    private readonly propertyRepo: PropertyRepository,
  ) {}

  async findStaffMemberById(id: string): Promise<IdentityStaffMemberEntity | null> {
    return this.staffRepo.findOneById(id)
  }

  async findPropertyById(id: string): Promise<PropertyEntity | null> {
    return this.propertyRepo.findOneById(id)
  }
}
