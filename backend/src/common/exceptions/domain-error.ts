export type DomainErrorCode =
  | 'CHECK_IN_IN_PAST'
  | 'CHECK_OUT_BEFORE_CHECK_IN'
  | 'MINIMUM_DURATION_NOT_MET'
  | 'MAX_STAYING_DAYS_EXCEEDED'
  | 'NAME_REQUIRED'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'INVALID_CPF'
  | 'NO_ROOMS_FOR_CAPACITY'
  | 'HOTEL_NOT_FOUND'
  | 'ROOM_NOT_AVAILABLE'
  | 'SESSION_EXPIRED'
  | 'ROOM_NOT_FOUND'

export interface BaseDomainError {
  readonly code: DomainErrorCode
  readonly message: string
}

export interface MaxStayingDaysError extends BaseDomainError {
  readonly code: 'MAX_STAYING_DAYS_EXCEEDED'
  readonly attempted: number
  readonly max: number
}

export interface NoRoomsForCapacityError extends BaseDomainError {
  readonly code: 'NO_ROOMS_FOR_CAPACITY'
  readonly guests: number
}

export type DomainError =
  | BaseDomainError
  | MaxStayingDaysError
  | NoRoomsForCapacityError

export const DomainError = {
  CHECK_IN_IN_PAST: (): DomainError => ({
    code: 'CHECK_IN_IN_PAST',
    message: 'Check-in date cannot be in the past',
  }),

  ROOM_NOT_FOUND: (): DomainError => ({
    code: 'ROOM_NOT_FOUND',
    message: 'Room not found for this session'
  }),

  MAX_STAYING_DAYS_EXCEEDED: (attempted: number, max: number): MaxStayingDaysError => ({
    code: 'MAX_STAYING_DAYS_EXCEEDED',
    attempted,
    max,
    message: `Stay of ${attempted} days exceeds the ${max}-day limit`,
  }),

  CHECK_OUT_BEFORE_CHECK_IN: (): DomainError => ({
    code: 'CHECK_OUT_BEFORE_CHECK_IN',
    message: 'Check-out date must be after check-in date',
  }),

  MINIMUM_DURATION_NOT_MET: (): DomainError => ({
    code: 'MINIMUM_DURATION_NOT_MET',
    message: 'Reservation must have a minimum duration of 1 day',
  }),

  NAME_REQUIRED: (): DomainError => ({
    code: 'NAME_REQUIRED',
    message: 'Name is required',
  }),

  INVALID_EMAIL: (): DomainError => ({
    code: 'INVALID_EMAIL',
    message: 'Invalid email',
  }),

  INVALID_PHONE: (): DomainError => ({
    code: 'INVALID_PHONE',
    message: 'Invalid phone number',
  }),

  INVALID_CPF: (): DomainError => ({
    code: 'INVALID_CPF',
    message: 'Invalid CPF',
  }),

  NO_ROOMS_FOR_CAPACITY: (guests: number): NoRoomsForCapacityError => ({
    code: 'NO_ROOMS_FOR_CAPACITY',
    guests,
    message: `No rooms available for ${guests} guests`,
  }),

  HOTEL_NOT_FOUND: (): DomainError => ({
    code: 'HOTEL_NOT_FOUND',
    message: 'Hotel not found',
  }),

  ROOM_NOT_AVAILABLE: (): DomainError => ({
    code: 'ROOM_NOT_AVAILABLE',
    message: 'Room is no longer available',
  }),

  SESSION_EXPIRED: (): DomainError => ({
    code: 'SESSION_EXPIRED',
    message: 'This booking link has expired',
  }),
} as const