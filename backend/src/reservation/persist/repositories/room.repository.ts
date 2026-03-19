import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { RoomEntity } from '../entities'

export class RoomRepository extends DefaultTypeOrmRepository<RoomEntity> {
  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(RoomEntity, dataSource.manager)
  }

  async findOneBy(where: any): Promise<RoomEntity | null> {
    return this.findOne({ where })
  }

  protected toDomain(row: any) {
    return new RoomEntity({
      id: row.id,
      name: row.name,
      hotelId: row.hotelId,
      capacity: row.capacity,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}