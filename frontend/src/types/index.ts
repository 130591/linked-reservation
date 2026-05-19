export interface Room {
  id: string
  name: string
  capacity: number
  pricePerNight: number
  short?: string
  description?: string
  amenities?: string[]
  tag?: string
  hueA?: number
  hueB?: number
}

export interface ConfirmationView {
  bookingReference: string
  property: {
    name: string
    whatsappNumber: string
    checkInTime?: string
    checkOutTime?: string
  }
  room: { id: string; name: string }
  period: { checkIn: string; checkOut: string }
  guests: number
  totalPaid: { amount: number; currency: 'BRL' }
  guest: { name: string; email: string; phone: string }
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

export interface PaymentStatusResult {
  status: PaymentStatus
  succeededAt: string | null
}

export interface CreatePaymentIntentBody {
  reservationId: string
  guestName: string
  guestEmail: string
  guestPhone: string
}

export interface CreatePaymentIntentResult {
  intentId: string
  clientSecret: string
  publishableKey: string
}

export interface ConfirmBookingResult {
  viewToken: string
  confirmation: ConfirmationView
}
