import { Test, TestingModule } from '@nestjs/testing'
import { STRIPE_CLIENT, StripeProvider } from '../stripe.provider'
import { ConfigService } from '@/common/config'

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'stripeSecretKey') return 'sk_test_mock_secret'
    return undefined
  }),
}

describe('Scenario: Stripe client provider', () => {
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        StripeProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Given the Stripe module is resolved', () => {
    it('When two consumers request STRIPE_CLIENT, Then they receive the same singleton instance', () => {
      const first  = module.get(STRIPE_CLIENT)
      const second = module.get(STRIPE_CLIENT)

      expect(first).toBe(second)
    })

    it('When the provider constructs the SDK, Then it uses the secret key from ConfigService, not process.env', () => {
      const client = module.get(STRIPE_CLIENT)

      expect(mockConfigService.get).toHaveBeenCalledWith('stripeSecretKey')
      expect(client).toHaveProperty('paymentIntents')
      expect(client).toHaveProperty('webhooks')
    })
  })
})
