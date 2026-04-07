import { Test, TestingModule } from '@nestjs/testing'
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Auth0JwtGuard } from '@/identity/http/guards/auth0-jwt.guard'
import { IdentityStaffMemberRepository } from '@/identity/persist/repositories/identity-staff-member.repository'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { PropertyEntity } from '@/identity/persist/entities/property'
import { IdentityStaffMemberEntity } from '@/identity/persist/entities/identity-staff-member'
import { ConfigService } from '@/common/config'

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mocked-jwks'),
  jwtVerify: jest.fn(),
}))

import { jwtVerify } from 'jose'

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (target: any, key: any, descriptor: any) => descriptor,
  initializeTransactionalContext: jest.fn(),
}))

const mockJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>

const VALID_PAYLOAD = {
  sub: 'auth0|user-123',
  email: 'admin@pousada.com',
  name: 'João Silva',
  'app_metadata': {
    propertyId: 'property-uuid',
    role: 'property_admin',
  },
}

const makeContext = (token?: string): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({
      headers: {
        authorization: token ? `Bearer ${token}` : undefined,
      },
    }),
  }),
} as any)

describe('Scenario: Auth0 JWT Guard — authentication and authorization', () => {
  let guard: Auth0JwtGuard
  let staffRepo: jest.Mocked<IdentityStaffMemberRepository>
  let propertyRepo: jest.Mocked<PropertyRepository>

  const staffMember = new IdentityStaffMemberEntity({
    id: 'staff-uuid',
    auth0Sub: 'auth0|user-123',
    email: 'admin@pousada.com',
    name: 'João Silva',
    role: 'property_admin',
    propertyId: 'property-uuid',
    active: true,
  })

  const activeProperty = new PropertyEntity({
    id: 'property-uuid',
    name: 'Pousada Beira Mar',
    type: 'pousada',
    status: 'active',
    trialExpiresAt: null,
  })

  beforeEach(async () => {
    staffRepo = {
      upsertByAuth0Sub: jest.fn().mockResolvedValue(staffMember),
    } as any

    propertyRepo = {
      findOneById: jest.fn().mockResolvedValue(activeProperty),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Auth0JwtGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'auth0Domain') return 'test.auth0.com'
              if (key === 'auth0Audience') return 'https://api.test'
              return null
            }),
          },
        },
        { provide: IdentityStaffMemberRepository, useValue: staffRepo },
        { provide: PropertyRepository, useValue: propertyRepo },
      ],
    }).compile()

    guard = module.get(Auth0JwtGuard)
  })

  describe('Given a valid RS256 JWT for an active property', () => {
    it('When the guard runs, then canActivate returns true and staff is set on request', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: VALID_PAYLOAD } as any)

      const ctx = makeContext('valid-token')
      const result = await guard.canActivate(ctx)

      expect(result).toBe(true)
      expect(staffRepo.upsertByAuth0Sub).toHaveBeenCalledWith(
        expect.objectContaining({ auth0Sub: 'auth0|user-123', role: 'property_admin' }),
      )
    })

    it('And on a second call with the same JWT, the staff is upserted (no duplicate error)', async () => {
      mockJwtVerify.mockResolvedValue({ payload: VALID_PAYLOAD } as any)

      await guard.canActivate(makeContext('token'))
      await guard.canActivate(makeContext('token'))

      expect(staffRepo.upsertByAuth0Sub).toHaveBeenCalledTimes(2)
    })
  })

  describe('Given a valid JWT for a trial property within expiry', () => {
    it('When the guard runs, then access is granted', async () => {
      const futureExpiry = new Date()
      futureExpiry.setDate(futureExpiry.getDate() + 5)

      propertyRepo.findOneById.mockResolvedValueOnce(
        new PropertyEntity({
          id: 'property-uuid',
          name: 'Pousada Beira Mar',
          type: 'pousada',
          status: 'trial',
          trialExpiresAt: futureExpiry,
        }),
      )

      mockJwtVerify.mockResolvedValueOnce({ payload: VALID_PAYLOAD } as any)

      const result = await guard.canActivate(makeContext('valid-token'))
      expect(result).toBe(true)
    })
  })

  describe('Given a valid JWT for a trial property with expired trial', () => {
    it('When the guard runs, then a ForbiddenException is thrown', async () => {
      const pastExpiry = new Date()
      pastExpiry.setDate(pastExpiry.getDate() - 1)

      propertyRepo.findOneById.mockResolvedValueOnce(
        new PropertyEntity({
          id: 'property-uuid',
          name: 'Pousada Beira Mar',
          type: 'pousada',
          status: 'trial',
          trialExpiresAt: pastExpiry,
        }),
      )

      mockJwtVerify.mockResolvedValueOnce({ payload: VALID_PAYLOAD } as any)

      await expect(guard.canActivate(makeContext('valid-token'))).rejects.toThrow(ForbiddenException)
    })
  })

  describe('Given a valid JWT for a suspended property', () => {
    it('When the guard runs, then a ForbiddenException is thrown', async () => {
      propertyRepo.findOneById.mockResolvedValueOnce(
        new PropertyEntity({
          id: 'property-uuid',
          name: 'Pousada Beira Mar',
          type: 'pousada',
          status: 'suspended',
          trialExpiresAt: null,
        }),
      )

      mockJwtVerify.mockResolvedValueOnce({ payload: VALID_PAYLOAD } as any)

      await expect(guard.canActivate(makeContext('valid-token'))).rejects.toThrow(ForbiddenException)
    })
  })

  describe('Given an expired or invalid JWT', () => {
    it('When the guard runs, then an UnauthorizedException is thrown', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('JWT expired'))

      await expect(guard.canActivate(makeContext('expired-token'))).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('Given no Authorization header', () => {
    it('When the guard runs, then an UnauthorizedException is thrown', async () => {
      await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('Given a JWT with wrong audience', () => {
    it('When the guard runs, then an UnauthorizedException is thrown', async () => {
      mockJwtVerify.mockRejectedValueOnce(new Error('unexpected "aud" claim value'))

      await expect(guard.canActivate(makeContext('wrong-audience-token'))).rejects.toThrow(UnauthorizedException)
    })
  })
})
