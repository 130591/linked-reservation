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
  | 'PROPERTY_NOT_FOUND'
  | 'PROPERTY_SUSPENDED'
  | 'PROPERTY_TRIAL_EXPIRED'
  | 'INVALID_PROPERTY_TYPE'
  | 'INVALID_PROPERTY_STATUS'
  | 'STAFF_NOT_AUTHORIZED'
  | 'STAFF_INVITATION_FAILED'
  | 'AUTH0_USER_CREATION_FAILED'
  | 'EVENT_PUBLISH_FAILED'
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

  PROPERTY_NOT_FOUND: (): DomainError => ({
    code: 'PROPERTY_NOT_FOUND',
    message: 'Property not found',
  }),

  PROPERTY_SUSPENDED: (): DomainError => ({
    code: 'PROPERTY_SUSPENDED',
    message: 'Property account is suspended',
  }),

  PROPERTY_TRIAL_EXPIRED: (): DomainError => ({
    code: 'PROPERTY_TRIAL_EXPIRED',
    message: 'Property trial period has expired',
  }),

  INVALID_PROPERTY_TYPE: (value: string): DomainError => ({
    code: 'INVALID_PROPERTY_TYPE',
    message: `Invalid property type: '${value}'. Must be one of: hotel, pousada, hostel, other`,
  }),

  INVALID_PROPERTY_STATUS: (value: string): DomainError => ({
    code: 'INVALID_PROPERTY_STATUS',
    message: `Invalid property status: '${value}'. Must be one of: trial, active, suspended`,
  }),

  STAFF_NOT_AUTHORIZED: (): DomainError => ({
    code: 'STAFF_NOT_AUTHORIZED',
    message: 'Staff member is not authorized to perform this action',
  }),

  STAFF_INVITATION_FAILED: (): DomainError => ({
    code: 'STAFF_INVITATION_FAILED',
    message: 'Failed to invite staff member. The email may already be in use.',
  }),

  AUTH0_USER_CREATION_FAILED: (): DomainError => ({
    code: 'AUTH0_USER_CREATION_FAILED',
    message: 'Failed to create user in Auth0',
  }),

  EVENT_PUBLISH_FAILED: (): DomainError => ({
    code: 'EVENT_PUBLISH_FAILED',
    message: 'Failed to publish domain event',
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