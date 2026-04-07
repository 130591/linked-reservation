import { Property } from '@/identity/core/domain/property'

function make(status: 'trial' | 'active' | 'suspended', trialExpiresAt: Date | null = null): Property {
  return Property.create('property-uuid', 'Pousada Beira Mar', 'pousada', status, trialExpiresAt)._unsafeUnwrap()
}

describe('Property domain model', () => {
  describe('Given an active property', () => {
    it('When checkAccess() is called, then it returns ok', () => {
      expect(make('active').checkAccess().isOk()).toBe(true)
    })
  })

  describe('Given a trial property within the trial period', () => {
    it('When checkAccess() is called, then it returns ok', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)

      expect(make('trial', futureDate).checkAccess().isOk()).toBe(true)
    })
  })

  describe('Given a trial property with an expired trial', () => {
    it('When checkAccess() is called, then it returns err(PROPERTY_TRIAL_EXPIRED)', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const result = make('trial', pastDate).checkAccess()

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('PROPERTY_TRIAL_EXPIRED')
      }
    })
  })

  describe('Given a suspended property', () => {
    it('When checkAccess() is called, then it returns err(PROPERTY_SUSPENDED)', () => {
      const result = make('suspended').checkAccess()

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('PROPERTY_SUSPENDED')
      }
    })

    it('And a suspended property with a past trialExpiresAt still returns PROPERTY_SUSPENDED (not PROPERTY_TRIAL_EXPIRED)', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      const result = make('suspended', pastDate).checkAccess()

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('PROPERTY_SUSPENDED')
      }
    })
  })
})
