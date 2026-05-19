import { Module, Global } from '@nestjs/common'
import { StripeProvider } from './stripe.provider'
import { StripeIntegrationClient } from './stripe.client'

@Global()
@Module({
  providers: [StripeProvider, StripeIntegrationClient],
  exports: [StripeProvider, StripeIntegrationClient],
})
export class StripeModule {}
