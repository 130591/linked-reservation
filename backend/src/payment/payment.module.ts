import { Module, forwardRef } from '@nestjs/common'
import { PaymentPersistenceModule } from './persist/persistence.module'
import { StripeModule } from '@/common/integrations/stripe'
import { PaymentIntentService } from './core/service/payment-intent.service'
import { ResolvePaymentStatus } from './core/service/resolve-payment-status'
import { PaymentEventsConsumer } from './jobs/payment-events.consumer'
import { PaymentAPI } from './external-api/payment-api'
import { WebhookController } from './http/controller/webhook'
import { PaymentController } from './http/controller/payment'
import { ReservationModule } from '@/reservation/reservation.module'

@Module({
  imports: [PaymentPersistenceModule, StripeModule, forwardRef(() => ReservationModule)],
  controllers: [WebhookController, PaymentController],
  providers: [PaymentIntentService, ResolvePaymentStatus, PaymentEventsConsumer, PaymentAPI],
  exports: [PaymentPersistenceModule, PaymentAPI],
})
export class PaymentModule {}
