import { Module, Global } from '@nestjs/common'
import { StripeProvider } from './stripe.provider'

@Global()
@Module({
  providers: [StripeProvider],
  exports: [StripeProvider],
})
export class StripeModule {}
