import { sharedConfigFactory } from '../shared-config'
import { ConfigException } from '../config.exception'

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  RESERVATION_TOKEN_SECRET: 'a-secret-that-is-long-enough-for-tests',
  SQS_BASE_URL: 'http://localhost:9324',
  AWS_REGION: 'us-east-1',
  ACCESS_KEY_ID: 'test',
  SECRET_ACCESS_KEY: 'test',
  WHATSAPP_API_URL: 'https://example.com',
  WHATSAPP_API_KEY: 'key',
  TWILIO_ACCOUNT_SID: 'AC000',
  TWILIO_AUTH_TOKEN: 'tok',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+1',
  SES_FROM_EMAIL: 'test@example.com',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  FRONTEND_URL: 'http://localhost:3000',
  BOOKING_BASE_URL: 'http://localhost:3000',
  AUTH0_DOMAIN: 'example.auth0.com',
  AUTH0_AUDIENCE: 'https://api.test',
  AUTH0_MANAGEMENT_CLIENT_ID: 'mgmt-id',
  AUTH0_MANAGEMENT_CLIENT_SECRET: 'mgmt-secret',
  SYSTEM_ADMIN_KEY: 'admin-key',
  STRIPE_SECRET_KEY: 'sk_test_abc',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
  STRIPE_WEBHOOK_SECRET: 'whsec_abc',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USERNAME: 'postgres',
  DATABASE_PASSWORD: 'postgres',
  DATABASE_NAME: 'test',
}

const withEnv = (overrides: Record<string, string | undefined>, fn: () => void) => {
  const original: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries({ ...VALID_ENV, ...overrides })) {
    original[k] = process.env[k]
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
  try {
    fn()
  } finally {
    for (const [k, v] of Object.entries(original)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

describe('Scenario: Stripe configuration validation', () => {
  describe('Given the environment is missing STRIPE_SECRET_KEY', () => {
    it('When sharedConfigFactory is called, Then it throws ConfigException', () => {
      withEnv({ STRIPE_SECRET_KEY: undefined }, () => {
        expect(() => sharedConfigFactory()).toThrow(ConfigException)
      })
    })
  })

  describe('Given the environment is missing STRIPE_WEBHOOK_SECRET', () => {
    it('When sharedConfigFactory is called, Then it throws ConfigException', () => {
      withEnv({ STRIPE_WEBHOOK_SECRET: undefined }, () => {
        expect(() => sharedConfigFactory()).toThrow(ConfigException)
      })
    })
  })

  describe('Given the environment is missing STRIPE_PUBLISHABLE_KEY', () => {
    it('When sharedConfigFactory is called, Then it throws ConfigException', () => {
      withEnv({ STRIPE_PUBLISHABLE_KEY: undefined }, () => {
        expect(() => sharedConfigFactory()).toThrow(ConfigException)
      })
    })
  })

  describe('Given all three Stripe keys are present', () => {
    it('When sharedConfigFactory is called, Then the config exposes them as typed strings', () => {
      withEnv({}, () => {
        const config = sharedConfigFactory()
        expect(config.stripeSecretKey).toBe('sk_test_abc')
        expect(config.stripePublishableKey).toBe('pk_test_abc')
        expect(config.stripeWebhookSecret).toBe('whsec_abc')
      })
    })
  })
})
