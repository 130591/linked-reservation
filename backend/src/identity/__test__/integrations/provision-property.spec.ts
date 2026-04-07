import { Test, TestingModule } from '@nestjs/testing'
import { ProvisionPropertyService } from '@/identity/core/service/provision-property'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { PropertyEntity } from '@/identity/persist/entities/property'
import { AUTH0_MANAGEMENT } from '@/identity/core/contract/identity-token'
import { EVENT_BUS } from '@/common/messaging'
import { DomainEvents } from '@/common/events'
import { FakeAuth0Management } from '../fixture/auth0'
import { FakeEventBus } from '@/reservation/__test__/fixture/events'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
}))

describe('Scenario: Admin provisions a new accommodation property', () => {
  let service: ProvisionPropertyService
  let propertyRepo: jest.Mocked<PropertyRepository>
  let fakeAuth0: FakeAuth0Management
  let fakeEventBus: FakeEventBus

  const command = {
    name: 'Pousada Beira Mar',
    type: 'pousada' as const,
    adminEmail: 'admin@pousada.com',
    adminName: 'João Silva',
  }

  beforeEach(async () => {
    fakeAuth0 = new FakeAuth0Management()
    fakeEventBus = new FakeEventBus()

    propertyRepo = {
      save: jest.fn(),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisionPropertyService,
        { provide: PropertyRepository, useValue: propertyRepo },
        { provide: AUTH0_MANAGEMENT, useValue: fakeAuth0 },
        { provide: EVENT_BUS, useValue: fakeEventBus },
      ],
    }).compile()

    service = module.get(ProvisionPropertyService)
  })

  describe('Given valid property data', () => {
    const savedProperty = new PropertyEntity({
      id: 'property-uuid',
      name: command.name,
      type: command.type,
      status: 'trial',
      trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    beforeEach(() => {
      propertyRepo.save.mockResolvedValue(savedProperty)
    })

    it('When the admin provisions the property, then it is created with trial status and 7-day expiry', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-04'))

      await service.handle(command)

      expect(propertyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: command.name,
          type: command.type,
          status: 'trial',
        }),
      )

      const savedArg = (propertyRepo.save as jest.Mock).mock.calls[0][0]
      const expectedExpiry = new Date('2026-04-11')
      expect(savedArg.trialExpiresAt.toDateString()).toBe(expectedExpiry.toDateString())

      jest.useRealTimers()
    })

    it('And the Auth0 user is created with property_admin role and correct propertyId', async () => {
      await service.handle(command)

      expect(fakeAuth0.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: command.adminEmail,
          name: command.adminName,
          app_metadata: expect.objectContaining({
            propertyId: 'property-uuid',
            role: 'property_admin',
          }),
        }),
      )
    })

    it('And the property.provisioned event is published to the EventBus', async () => {
      const result = await service.handle(command)

      if (result.isErr()) throw result.error

      const event = fakeEventBus.published.find(
        e => e.queue === DomainEvents.PROPERTY_PROVISIONED,
      )
      expect(event).toBeDefined()
      expect(event?.payload).toEqual(
        expect.objectContaining({
          propertyId: 'property-uuid',
          adminEmail: command.adminEmail,
        }),
      )
    })

    it('And the result contains the propertyId and auth0UserId', async () => {
      const result = await service.handle(command)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.propertyId).toBe('property-uuid')
        expect(result.value.auth0UserId).toMatch(/^auth0\|fake-/)
      }
    })
  })

  describe('Given the Auth0 client throws an error', () => {
    it('When provisioning is attempted, then the result is err() and no event is published', async () => {
      propertyRepo.save.mockResolvedValue(
        new PropertyEntity({ id: 'property-uuid', name: command.name, type: command.type, status: 'trial', trialExpiresAt: null }),
      )
      fakeAuth0.users.create.mockRejectedValueOnce(new Error('Auth0 unavailable'))

      const result = await service.handle(command)

      expect(result.isErr()).toBe(true)
      expect(fakeEventBus.published).toHaveLength(0)
    })
  })
})
