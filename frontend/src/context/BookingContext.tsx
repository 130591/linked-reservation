import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Room } from '../types'

export interface GuestDetails {
  name: string
  email: string
  phone: string
}

interface BookingState {
  selectedRoom: Room | null
  reservationId: string | null
  guestDetails: GuestDetails | null
}

interface BookingContextValue extends BookingState {
  setSelectedRoom: (room: Room) => void
  setReservationId: (id: string) => void
  setGuestDetails: (details: GuestDetails) => void
}

export const BookingContext = createContext<BookingContextValue>({
  selectedRoom: null,
  reservationId: null,
  guestDetails: null,
  setSelectedRoom: () => undefined,
  setReservationId: () => undefined,
  setGuestDetails: () => undefined,
})

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [guestDetails, setGuestDetails] = useState<GuestDetails | null>(null)

  return (
    <BookingContext.Provider
      value={{ selectedRoom, reservationId, guestDetails, setSelectedRoom, setReservationId, setGuestDetails }}
    >
      {children}
    </BookingContext.Provider>
  )
}

export function useBooking(): BookingContextValue {
  return useContext(BookingContext)
}
