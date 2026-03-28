import { ConfigException } from './config.exception'
import { z } from 'zod'

export const environmentSchema = z.enum(['test', 'development', 'production'])

export const sharedConfigSchema = z.object({
  env: environmentSchema,
  reservationTokenSecret: z.string(),
  sqsBaseUrl: z.string(),
  awsRegion: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  whatsappApiUrl: z.string(),
  whatsappApiKey: z.string(),
  twilioAccountSid: z.string(),
  twilioAuthToken: z.string(),
  twilioWhatsAppFrom: z.string(),
  sesFromEmail: z.string(),
  anthropicApiKey: z.string(),
  frontendUrl: z.string().url(),
  bookingBaseUrl: z.string().url(),
  
  database: z.object({
    host: z.string(),
    port: z.number(),
    username: z.string(),
    password: z.string(),
    database: z.string(),
  }),
})

export type Environment = z.infer<typeof environmentSchema>

export type SharedConfig = z.infer<typeof sharedConfigSchema>

export const sharedConfigFactory = (): SharedConfig => {
  const result = sharedConfigSchema.safeParse({
    env: process.env.NODE_ENV,
    reservationTokenSecret: process.env.RESERVATION_TOKEN_SECRET,
    sqsBaseUrl: process.env.SQS_BASE_URL,
    awsRegion: process.env.AWS_REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    whatsappApiUrl: process.env.WHATSAPP_API_URL,
    whatsappApiKey: process.env.WHATSAPP_API_KEY,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM,
    sesFromEmail: process.env.SES_FROM_EMAIL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    bookingBaseUrl: process.env.BOOKING_BASE_URL || 'http://localhost:3000',
    database: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 5432,
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    },
  })

  if (result.success) {
    return result.data
  }

  throw new ConfigException(`Invalid application configuration: ${result.error.message}`)
}