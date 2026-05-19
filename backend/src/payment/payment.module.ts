import { Module, forwardRef } from '@nestjs/common'
import { PaymentPersistenceModule } from './persist/persistence.module'
import { StripeModule } from '@/common/integrations/stripe'
import { PaymentIntentService } from './core/service/payment-intent.service'
import { PaymentEventsConsumer } from './jobs/payment-events.consumer'
import { PaymentAPI } from './external-api/payment-api'
import { WebhookController } from './http/controller/webhook'
import { ReservationModule } from '@/reservation/reservation.module'

@Module({
  imports: [PaymentPersistenceModule, StripeModule, forwardRef(() => ReservationModule)],
  controllers: [WebhookController],
  providers: [PaymentIntentService, PaymentEventsConsumer, PaymentAPI],
  exports: [PaymentPersistenceModule, PaymentAPI],
})
export class PaymentModule {}
