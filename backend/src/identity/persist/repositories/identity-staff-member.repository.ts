import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { DefaultTypeOrmRepository } from '@/common/database'
import { IdentityStaffMemberEntity, IdentityRole } from '../entities/identity-staff-member'

export interface UpsertStaffMemberData {
  auth0Sub: string
  email: string
  name: string
  role: IdentityRole
  propertyId: string
  active?: boolean
}

@Injectable()
export class IdentityStaffMemberRepository extends DefaultTypeOrmRepository<IdentityStaffMemberEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource,
  ) {
    super(IdentityStaffMemberEntity, dataSource.manager)
  }

  async findByAuth0Sub(sub: string): Promise<IdentityStaffMemberEntity | null> {
    return this.findOne({ where: { auth0Sub: sub } as any })
  }

  async findAdminByPropertyId(propertyId: string): Promise<IdentityStaffMemberEntity | null> {
    return this.findOne({ where: { propertyId, role: 'property_admin' } as any })
  }

  async upsertByAuth0Sub(data: UpsertStaffMemberData): Promise<IdentityStaffMemberEntity> {
    await this.transactionalEntityManager
      .getRepository(IdentityStaffMemberEntity)
      .upsert(
        { ...data, active: data.active ?? true },
        { conflictPaths: ['auth0Sub'], skipUpdateIfNoValuesChanged: true },
      )
    return (await this.findByAuth0Sub(data.auth0Sub))!
  }

  protected toDomain(row: any): IdentityStaffMemberEntity {
    return new IdentityStaffMemberEntity(row)
  }
}
