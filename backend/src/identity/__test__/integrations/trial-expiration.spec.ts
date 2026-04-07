import { Test, TestingModule } from '@nestjs/testing'
import { TrialExpirationJob } from '@/identity/jobs/trial-expiration.job'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { IdentityStaffMemberRepository } from '@/identity/persist/repositories/identity-staff-member.repository'
import { Property } from '@/identity/core/domain/property'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'
import { EVENT_BUS } from '@/common/messaging'
import { DomainEvents } from '@/common/events'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
}))

describe('Scenario: Trial expiration job runs at midnight', () => {
  let job: TrialExpirationJob
  let propertyRepo: jest.Mocked<PropertyRepository>
  let staffRepo: jest.Mocked<IdentityStaffMemberRepository>
  let eventBus: FakeEventBus

  const adminStaff = new IdentityStaffMemberEntity({
    id: 'staff-uuid',
    auth0Sub: 'auth0|admin',
    email: 'admin@pousada.com',
    name: 'João Admin',
    role: 'property_admin',
    propertyId: 'property-uuid',
    active: true,
  })

  beforeEach(async () => {
    eventBus = new FakeEventBus()

    propertyRepo = {
      findTrialPropertiesExpiring: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any

    staffRepo = {
      findAdminByPropertyId: jest.fn().mockResolvedValue(adminStaff),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialExpirationJob,
        { provide: PropertyRepository, useValue: propertyRepo },
        { provide: IdentityStaffMemberRepository, useValue: staffRepo },
        { provide: EVENT_BUS, useValue: eventBus },
      ],
    }).compile()

    job = module.get(TrialExpirationJob)
  })

  describe('Given properties with trialExpiresAt in the past', () => {
    const expiredProperty = Property.create(
      'property-uuid', 'Pousada Expirada', 'pousada', 'trial',
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    )._unsafeUnwrap()

    beforeEach(() => {
      propertyRepo.findTrialPropertiesExpiring
        .mockResolvedValueOnce([expiredProperty])  // expired now
        .mockResolvedValueOnce([expiredProperty])  // expiring in 2 days (includes expired)
    })

    it('When the job runs, then the property status is updated to suspended', async () => {
      await job.run()

      expect(propertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'property-uuid', status: 'suspended' }),
      )
    })

    it('And the property.trial.expiring event is NOT published for already-expired properties', async () => {
      await job.run()

      const event = eventBus.published.find(e => e.queue === DomainEvents.PROPERTY_TRIAL_EXPIRING)
      expect(event).toBeUndefined()
    })
  })

  describe('Given properties expiring within 2 days (but not yet expired)', () => {
    const soonProperty = Property.create(
      'property-soon-uuid', 'Pousada Quase Expirando', 'hostel', 'trial',
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    )._unsafeUnwrap()

    beforeEach(() => {
      staffRepo.findAdminByPropertyId.mockResolvedValue(
        new IdentityStaffMemberEntity({
          id: 'staff-soon-uuid',
          auth0Sub: 'auth0|admin-soon',
          email: 'admin@hostel.com',
          name: 'Ana Admin',
          role: 'property_admin',
          propertyId: 'property-soon-uuid',
          active: true,
        }),
      )

      propertyRepo.findTrialPropertiesExpiring
        .mockResolvedValueOnce([])              // none expired yet
        .mockResolvedValueOnce([soonProperty])  // expiring within 2 days
    })

    it('When the job runs, then the property.trial.expiring event is published with propertyId and adminEmail', async () => {
      await job.run()

      const event = eventBus.published.find(e => e.queue === DomainEvents.PROPERTY_TRIAL_EXPIRING)
      expect(event).toBeDefined()
      expect(event?.payload).toEqual(
        expect.objectContaining({
          propertyId: 'property-soon-uuid',
          adminEmail: 'admin@hostel.com',
        }),
      )
    })

    it('And the property status is NOT updated to suspended', async () => {
      await job.run()

      expect(propertyRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('Given no expiring properties', () => {
    beforeEach(() => {
      propertyRepo.findTrialPropertiesExpiring.mockResolvedValue([])
    })

    it('When the job runs, then no DB writes occur and no events are published', async () => {
      await job.run()

      expect(propertyRepo.save).not.toHaveBeenCalled()
      expect(eventBus.published).toHaveLength(0)
    })
  })
})
