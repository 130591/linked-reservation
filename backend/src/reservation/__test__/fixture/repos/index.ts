import { ReservationEntity, ReservationSessionEntity } from "@/reservation/persist"

export class FakeSessionRepository {
  private store = new Map<string, ReservationSessionEntity>()

  seed(entity: ReservationSessionEntity) {
    this.store.set(entity.externalId, entity)
  }

  async findOneById(id: string) {
    return this.store.get(id) ?? null
  }

  async update(criteria: any, data: any) {
    let affected = 0
    for (const [id, entity] of this.store) {
      const matches = Object.entries(criteria).every(
        ([key, value]) => (entity as any)[key] === value
      )
      if (matches) {
        Object.assign(entity, data)
        affected++
      }
    }
    return { affected }
  }

  get(id: string) {
    return this.store.get(id)
  }
}

export class FakeReservationRepository {
  private store = new Map<string, ReservationEntity>()

  seed(entity: ReservationEntity) {
    this.store.set(entity.externalId, entity)
  }

  async update(criteria: any, data: any) {
    let affected = 0
    for (const [id, entity] of this.store) {
      const matches = Object.entries(criteria).every(([key, value]) => {
        if (typeof value === 'object' && value !== null && '_type' in value) {
          // IsNull() operator from TypeORM
          return (entity as any)[key] === null
        }
        return (entity as any)[key] === value
      })
      if (matches) {
        Object.assign(entity, data)
        affected++
      }
    }
    return { affected }
  }

  getAll(): ReservationEntity[] {
    return [...this.store.values()]
  }
}