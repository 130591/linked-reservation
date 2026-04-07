import { Test, TestingModule } from '@nestjs/testing'
import { InviteStaffService } from '@/identity/core/service/invite-staff'
import { AUTH0_MANAGEMENT } from '@/identity/core/contract/identity-token'
import { DomainError } from '@/common/exceptions'
import { FakeAuth0Management } from '../fixture/auth0'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
}))

describe('Scenario: Property admin invites a staff member', () => {
  let service: InviteStaffService
  let fakeAuth0: FakeAuth0Management

  const propertyId = 'property-uuid'

  beforeEach(async () => {
    fakeAuth0 = new FakeAuth0Management()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteStaffService,
        { provide: AUTH0_MANAGEMENT, useValue: fakeAuth0 },
      ],
    }).compile()

    service = module.get(InviteStaffService)
  })

  describe('Given the inviter is a property_admin', () => {
    const command = {
      inviterRole: 'property_admin' as const,
      inviterPropertyId: propertyId,
      email: 'staff@pousada.com',
      name: 'Maria Souza',
    }

    it('When they invite a staff member, then the Auth0 user is created with staff role', async () => {
      const result = await service.handle(command)

      expect(result.isOk()).toBe(true)
      expect(fakeAuth0.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: command.email,
          name: command.name,
          app_metadata: expect.objectContaining({
            propertyId,
            role: 'staff',
          }),
        }),
      )
    })

    it('And the result contains the auth0UserId', async () => {
      const result = await service.handle(command)

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.auth0UserId).toMatch(/^auth0\|fake-/)
      }
    })
  })

  describe('Given the inviter is a regular staff (not admin)', () => {
    const command = {
      inviterRole: 'staff' as const,
      inviterPropertyId: propertyId,
      email: 'another@pousada.com',
      name: 'Carlos Lima',
    }

    it('When they attempt to invite, then the result is err(STAFF_NOT_AUTHORIZED) and Auth0 is NOT called', async () => {
      const result = await service.handle(command)

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toEqual(DomainError.STAFF_NOT_AUTHORIZED())
      }
      expect(fakeAuth0.users.create).not.toHaveBeenCalled()
    })
  })

  describe('Given the Auth0 client throws an error', () => {
    const command = {
      inviterRole: 'property_admin' as const,
      inviterPropertyId: propertyId,
      email: 'fail@pousada.com',
      name: 'Erro Teste',
    }

    it('When the invite is attempted, then the result is err()', async () => {
      fakeAuth0.users.create.mockRejectedValueOnce(new Error('Auth0 unavailable'))

      const result = await service.handle(command)

      expect(result.isErr()).toBe(true)
    })
  })
})
