import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { StaffMemberEntity } from '../entities/staff-member'

export class StaffMemberRepository extends DefaultTypeOrmRepository<StaffMemberEntity> {
  constructor(
    @InjectDataSource('reservation')
    private readonly dataSource: DataSource
  ) {
    super(StaffMemberEntity, dataSource.manager)
  }

  async findOwner(stayId: string): Promise<StaffMemberEntity | null> {
    return this.findOne({ where: { stayId, role: 'OWNER' } as any })
  }

  async findBot(stayId: string): Promise<StaffMemberEntity | null> {
    return this.findOne({ where: { stayId, role: 'BOT' } as any })
  }

  async findByStay(stayId: string): Promise<StaffMemberEntity[]> {
    return this.find({ 
      where: { stayId } as any,
      order: { 
        role: 'ASC', 
        name: 'ASC' 
      }
    })
  }

  async findByEmail(email: string): Promise<StaffMemberEntity | null> {
    return this.findOne({ where: { email } as any })
  }

  protected toDomain(row: any): StaffMemberEntity {
    return new StaffMemberEntity({
      id: row.id,
      stayId: row.stayId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      isAvailable: row.isAvailable,
      maxConcurrentSessions: row.maxConcurrentSessions,
      currentSessions: row.currentSessions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    })
  }
}
