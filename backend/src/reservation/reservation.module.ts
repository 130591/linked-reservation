import { Module } from '@nestjs/common'
import { ReservationPersistenceModule } from './persist/persistence.module'
import { ConfirmReservation, GenerateLink, ConfirmPayment } from './core/service'

@Module({
  imports: [ReservationPersistenceModule],
  providers: [ConfirmReservation, GenerateLink, ConfirmPayment],
  exports: [ConfirmReservation, GenerateLink, ConfirmPayment],
})
export class ReservationModule { }
