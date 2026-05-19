import { ReservationEntity } from '@/reservation/persist/entities/reservation'
import { ReservationSessionEntity } from '@/reservation/persist/entities/reservation-session'
import { RoomEntity } from '@/reservation/persist/entities/room'
import { StayEntity } from '@/reservation/persist/entities/stay'
import { PaymentIntentEntity } from '@/payment/persist/entities/payment-intent.entity'

export interface ConfirmationView {
  bookingReference: string
  property: { name: string; whatsappNumber: string }
  room: { id: string; name: string }
  period: { checkIn: string; checkOut: string }
  guests: number
  totalPaid: { amount: number; currency: 'BRL' }
  guest: { name: string; email: string; phone: string }
}

export function toConfirmationView(
  reservation: ReservationEntity,
  room: RoomEntity,
  stay: StayEntity,
  paymentIntent: PaymentIntentEntity,
  session: ReservationSessionEntity,
): ConfirmationView {
  return {
    bookingReference: reservation.bookingReference!,
    property: {
      name: stay.name,
      whatsappNumber: stay.whatsappNumber,
    },
    room: {
      id: room.externalId,
      name: room.name,
    },
    period: {
      checkIn: reservation.checkIn.toISOString(),
      checkOut: reservation.checkOut.toISOString(),
    },
    guests: session.guests,
    totalPaid: {
      amount: paymentIntent.amountCents,
      currency: 'BRL',
    },
    guest: {
      name: reservation.guestName!,
      email: reservation.guestEmail!,
      phone: reservation.guestPhone!,
    },
  }
}
