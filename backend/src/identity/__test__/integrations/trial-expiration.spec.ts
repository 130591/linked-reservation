import { DataSource } from 'typeorm'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { TrialExpirationJob } from '@/identity/jobs/trial-expiration.job'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { IdentityStaffMemberRepository } from '@/identity/persist/repositories/identity-staff-member.repository'
import { PropertyEntity } from '@/identity/persist/entities/property'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'
import { DomainEvents } from '@/common/events'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_t: any, _k: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
}))

const CONTAINER_STARTUP_TIMEOUT_MS = 120_000

describe('Scenario: Trial expiration job runs at midnight', () => {
  let container: StartedPostgreSqlContainer
  let dataSource: DataSource
  let propertyRepo: PropertyRepository
  let staffRepo: IdentityStaffMemberRepository
  let eventBus: FakeEventBus
  let job: TrialExpirationJob

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start()

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [PropertyEntity, IdentityStaffMemberEntity],
      synchronize: false,
    })

    await dataSource.initialize()
    await dataSource.query('CREATE SCHEMA IF NOT EXISTS identity')
    await dataSource.synchronize()

    propertyRepo = new PropertyRepository(dataSource)
    staffRepo    = new IdentityStaffMemberRepository(dataSource)
  }, CONTAINER_STARTUP_TIMEOUT_MS)

  afterAll(async () => {
    await dataSource?.destroy()
    await container?.stop()
  })

  beforeEach(async () => {
    await dataSource.query('TRUNCATE "identity"."properties", "identity"."identity_staff_members" RESTART IDENTITY CASCADE')
    eventBus = new FakeEventBus()
    job = new TrialExpirationJob(propertyRepo, staffRepo, eventBus)
  })

  const seedProperty = (overrides: Partial<PropertyEntity>): Promise<PropertyEntity> =>
    propertyRepo.save(new PropertyEntity({
      name:   'Pousada',
      type:   'pousada',
      status: 'trial',
      ...overrides,
    }))

  const seedAdmin = (propertyExternalId: string, email: string): Promise<IdentityStaffMemberEntity> =>
    staffRepo.save(new IdentityStaffMemberEntity({
      auth0Sub:   `auth0|${email}`,
      email,
      name:       'Admin',
      role:       'property_admin',
      propertyId: propertyExternalId,
      active:     true,
    }))

  const findById = async (id: string): Promise<PropertyEntity | null> =>
    propertyRepo.findOneById(id)

  describe('Given properties with trialExpiresAt in the past', () => {
    it('When the job runs, then the property status is updated to suspended', async () => {
      const expired = await seedProperty({
        name:           'Pousada Expirada',
        trialExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })

      await job.run()

      const after = await findById(expired.externalId)
      expect(after?.status).toBe('suspended')
    })

    it('And the property.trial.expiring event is NOT published for already-expired properties', async () => {
      const expired = await seedProperty({
        name:           'Pousada Expirada',
        trialExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      await seedAdmin(expired.externalId, 'admin@pousada.com')

      await job.run()

      const event = eventBus.published.find(e => e.queue === DomainEvents.PROPERTY_TRIAL_EXPIRING)
      expect(event).toBeUndefined()
    })
  })

  describe('Given properties expiring within 2 days (but not yet expired)', () => {
    it('When the job runs, then the property.trial.expiring event is published with propertyId and adminEmail', async () => {
      const soon = await seedProperty({
        name:           'Pousada Quase Expirando',
        type:           'hostel',
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      await seedAdmin(soon.externalId, 'admin@hostel.com')

      await job.run()

      const event = eventBus.published.find(e => e.queue === DomainEvents.PROPERTY_TRIAL_EXPIRING)
      expect(event).toBeDefined()
      expect(event?.payload).toEqual(
        expect.objectContaining({
          propertyId: soon.externalId,
          adminEmail: 'admin@hostel.com',
        }),
      )
    })

    it('And the property status is NOT updated to suspended', async () => {
      const soon = await seedProperty({
        trialExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      await seedAdmin(soon.externalId, 'admin@hostel.com')

      await job.run()

      const after = await findById(soon.externalId)
      expect(after?.status).toBe('trial')
    })
  })

  describe('Given no expiring properties', () => {
    it('When the job runs, then no events are published and no property is suspended', async () => {
      const future = await seedProperty({
        trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      await job.run()

      expect(eventBus.published).toHaveLength(0)
      const after = await findById(future.externalId)
      expect(after?.status).toBe('trial')
    })
  })
})
