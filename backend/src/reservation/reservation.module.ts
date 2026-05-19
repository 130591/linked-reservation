import { Module, forwardRef } from '@nestjs/common'
import { ReservationPersistenceModule } from './persist/persistence.module'
import {
  BookingReferenceService,
  ConfirmReservation,
  GenerateLink,
  ConfirmPayment,
  SelectRoom,
  ReservationTokenService,
} from './core/service'
import { BookingController } from './http/controller/booking'
import { ReservationController } from './http/controller/reservation'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { ReservationViewTokenGuard } from '@/common/framework/guards/reservation-view-token.guard'
import { GetAvailableRooms } from './core/service/get-available-rooms'
import { ReservationAPI } from './external-api'
import { SqsEventBus } from '@/common/messaging/sqs-event-bus'
import { EVENT_BUS } from '@/common/messaging/event-bus.interface'
import { PaymentModule } from '@/payment/payment.module'

@Module({
  imports: [ReservationPersistenceModule, forwardRef(() => PaymentModule)],
  controllers: [BookingController, ReservationController],
  providers: [
    BookingReferenceService,
    ConfirmReservation,
    GenerateLink,
    ConfirmPayment,
    SelectRoom,
    GetAvailableRooms,
    ReservationTokenService,
    ReservationTokenGuard,
    ReservationViewTokenGuard,
    ReservationAPI,
    SqsEventBus,
    {
      provide: EVENT_BUS,
      useClass: SqsEventBus,
    },
  ],
  exports: [
    BookingReferenceService,
    ConfirmPayment,
    ReservationAPI,
    ReservationTokenService,
    ReservationTokenGuard,
    ReservationViewTokenGuard,
  ],
})
export class ReservationModule {}
