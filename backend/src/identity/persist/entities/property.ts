import { DefaultEntity } from '@/common/database/entities'
import { Column, Entity } from 'typeorm'

export type PropertyType = 'hotel' | 'pousada' | 'hostel' | 'other'
export type PropertyStatus = 'trial' | 'active' | 'suspended'

@Entity({ name: 'properties', schema: 'identity' })
export class PropertyEntity extends DefaultEntity<PropertyEntity> {
  @Column()
  name: string

  @Column({ type: 'varchar' })
  type: PropertyType

  @Column({ type: 'varchar', default: 'trial' })
  status: PropertyStatus

  @Column({ name: 'trial_expires_at', type: 'timestamp', nullable: true })
  trialExpiresAt: Date | null
}
