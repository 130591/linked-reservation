import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { StayEntity } from '../entities/stay'

export class StayRepository extends DefaultTypeOrmRepository<StayEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(StayEntity, dataSource.manager)
  }

  async findByPhone(phone: string): Promise<StayEntity | null> {
    return this.findOne({ where: { phone } as any })
  }

  protected toDomain(row: any): StayEntity {
    return new StayEntity({
      id: row.id,
      name: row.name,
      phone: row.phone,
      type: row.type,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}
