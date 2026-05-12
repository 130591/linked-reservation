import { Module } from '@nestjs/common'
import { ReservationPersistenceModule } from './persist/persistence.module'
import {
  BookingReferenceService,
  ConfirmReservation,
  GenerateLink,
  ConfirmPayment,
  SelectRoom,
  ReservationTokenService
} from './core/service'
import { BookingController } from './http/controller/booking'
import { ReservationController } from './http/controller/reservation'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { GetAvailableRooms } from './core/service/get-available-rooms'
import { ReservationAPI } from './external-api'
import { SqsEventBus } from '@/common/messaging/sqs-event-bus'
import { EVENT_BUS } from '@/common/messaging/event-bus.interface'

@Module({
  imports: [ReservationPersistenceModule],
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
    ReservationAPI,
    SqsEventBus,
    {
      provide: EVENT_BUS,
      useClass: SqsEventBus
    }
  ],
  exports: [
    BookingReferenceService,
    ReservationAPI
  ],
})
export class ReservationModule { }
