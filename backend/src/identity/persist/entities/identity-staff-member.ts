import { DefaultEntity } from '@/common/database'
import { Column, Entity } from 'typeorm'

export type IdentityRole = 'property_admin' | 'staff'

@Entity({ name: 'identity_staff_members', schema: 'identity' })
export class IdentityStaffMemberEntity extends DefaultEntity<IdentityStaffMemberEntity> {
  @Column({ name: 'auth0_sub', unique: true })
  auth0Sub: string

  @Column()
  email: string

  @Column()
  name: string

  @Column({ type: 'varchar' })
  role: IdentityRole

  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string

  @Column({ default: true })
  active: boolean
}
