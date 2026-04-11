import { DataSource, LessThan } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { Injectable } from '@nestjs/common'
import { DefaultTypeOrmRepository } from '@/common/database'
import { PropertyEntity } from '../entities/property'
import { Property } from '@/identity/core/domain/property'

@Injectable()
export class PropertyRepository extends DefaultTypeOrmRepository<PropertyEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource,
  ) {
    super(PropertyEntity, dataSource.manager)
  }

  async findTrialPropertiesExpiring(before: Date): Promise<PropertyEntity[]> {
    return this.find({
      where: {
        status: 'trial',
        trialExpiresAt: LessThan(before),
      },
    })
  }

  protected toDomain(entity: PropertyEntity): Property {
    return Property.create(
      entity.externalId,
      entity.name,
      entity.type,
      entity.status,
      entity.trialExpiresAt,
    ).match(
      property => property,
      _err => { throw new Error(`Data corruption: property ${entity.externalId} (${entity.name}) has invalid type/status`) }
    )
  }
}