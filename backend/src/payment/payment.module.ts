import { Module } from '@nestjs/common'
import { PaymentPersistenceModule } from './persist/persistence.module'
import { StripeModule } from '@/common/integrations/stripe'
import { PaymentIntentService } from './core/service/payment-intent.service'
import { PaymentEventsConsumer } from './jobs/payment-events.consumer'
import { PaymentAPI } from './external-api/payment-api'

@Module({
  imports: [PaymentPersistenceModule, StripeModule],
  providers: [PaymentIntentService, PaymentEventsConsumer, PaymentAPI],
  exports: [PaymentPersistenceModule, PaymentAPI],
})
export class PaymentModule {}
