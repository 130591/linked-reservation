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

  async findTrialPropertiesExpiring(before: Date): Promise<Property[]> {
    const entities = await this.find({
      where: {
        status: 'trial',
        trialExpiresAt: LessThan(before),
      },
    })
    return entities.map(e => this.toDomain(e))
  }

  protected toDomain(entity: PropertyEntity): Property {
    return Property.create(
      entity.id,
      entity.name,
      entity.type,
      entity.status,
      entity.trialExpiresAt,
    ).match(
      property => property,
      _err => { throw new Error(`Data corruption in database: property ${entity.id} and ${entity.name}`) }
    )
  }
}