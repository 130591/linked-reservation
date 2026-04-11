import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { InjectDataSource } from '@nestjs/typeorm'
import { DefaultTypeOrmRepository } from '@/common/database'
import { OutboxEventEntity } from './outbox-event.entity'

@Injectable()
export class OutboxRepository extends DefaultTypeOrmRepository<OutboxEventEntity> {
  protected toDomain(row: any): OutboxEventEntity {
    throw new Error('Method not implemented.')
  }

  constructor(
    @InjectDataSource('reservation')
    dataSource: DataSource
  ) {
    super(OutboxEventEntity, dataSource.manager)
  }

  // SKIP LOCKED — multiply workers não pegam o mesmo evento
  async findUnpublished(limit = 50): Promise<OutboxEventEntity[]> {
    return this.manager.query(`
      SELECT * FROM outbox_events
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `, [limit])
  }

  async markPublished(ids: number[]): Promise<void> {
    await this.manager.query(`
      UPDATE outbox_events
      SET published_at = NOW()
      WHERE id = ANY($1)
    `, [ids])
  }
}