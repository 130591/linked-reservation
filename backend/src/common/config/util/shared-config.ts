import { ConfigException } from './config.exception'
import { z } from 'zod'

export const environmentSchema = z.enum(['test', 'development', 'production'])

export const sharedConfigSchema = z.object({
  env: environmentSchema,
  reservationTokenSecret: z.string(),
  sqsBaseUrl: z.string(),
  awsRegion: z.string(),
  whatsappApiUrl: z.string(),
  whatsappApiKey: z.string(),
  sesFromEmail: z.string(),
  anthropicApiKey: z.string(),
  frontendUrl: z.string().url(),
})

export type Environment = z.infer<typeof environmentSchema>

export type SharedConfig = z.infer<typeof sharedConfigSchema>

export const sharedConfigFactory = (): SharedConfig => {
  const result = sharedConfigSchema.safeParse({
    env: process.env.NODE_ENV,
    reservationTokenSecret: process.env.RESERVATION_TOKEN_SECRET,
    sqsBaseUrl: process.env.SQS_BASE_URL,
    awsRegion: process.env.AWS_REGION,
    whatsappApiUrl: process.env.WHATSAPP_API_URL,
    whatsappApiKey: process.env.WHATSAPP_API_KEY,
    sesFromEmail: process.env.SES_FROM_EMAIL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  })

  if (result.success) {
    return result.data
  }

  throw new ConfigException(`Invalid application configuration: ${result.error.message}`)
}