import { Module } from '@nestjs/common'
import { ReservationPersistenceModule } from './persist/persistence.module'
import {
  ConfirmReservation,
  GenerateLink,
  ConfirmPayment,
  SelectRoom,
  GetAvailableRooms,
  ReservationTokenService
} from './core/service'
import { BookingController } from './http/controller/booking'
import { ReservationController } from './http/controller/reservation'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'

@Module({
  imports: [ReservationPersistenceModule],
  controllers: [BookingController, ReservationController],
  providers: [
    ConfirmReservation,
    GenerateLink,
    ConfirmPayment,
    SelectRoom,
    GetAvailableRooms,
    ReservationTokenService,
    ReservationTokenGuard // For manual injection if needed, though Usually Guards are self-managed
  ],
  exports: [
    ConfirmReservation,
    GenerateLink,
    ConfirmPayment,
    SelectRoom,
    GetAvailableRooms,
    ReservationTokenService
  ],
})
export class ReservationModule { }
