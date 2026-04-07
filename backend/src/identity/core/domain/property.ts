import { err, ok, Result } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { PropertyEntity, PropertyStatus, PropertyType } from '@/identity/persist/entities'

const VALID_TYPES:    PropertyType[]   = ['hotel', 'pousada', 'hostel', 'other']
const VALID_STATUSES: PropertyStatus[] = ['trial', 'active', 'suspended']

type AccessPolicy = (p: Property) => Result<void, DomainError> | null

export class Property {
  private constructor(
    readonly id:             string,
    readonly name:           string,
    readonly type:           PropertyType,
    readonly status:         PropertyStatus,
    readonly trialExpiresAt: Date | null,
  ) {}

  static create(
    id:             string,
    name:           string,
    type:           PropertyType,
    status:         PropertyStatus,
    trialExpiresAt: Date | null,
  ): Result<Property, DomainError> {
    if (!VALID_TYPES.includes(type))     return err(DomainError.INVALID_PROPERTY_TYPE(type))
    if (!VALID_STATUSES.includes(status)) return err(DomainError.INVALID_PROPERTY_STATUS(status))
    return ok(new Property(id, name, type, status, trialExpiresAt))
  }

  trialExpiresAtOrThrow(): Date {
    if (this.trialExpiresAt === null) {
      throw new Error(`Property ${this.id} is not on trial`)
    }
    return this.trialExpiresAt
  }

  suspend(): Property {
    return new Property(this.id, this.name, this.type, 'suspended', this.trialExpiresAt)
  }

  checkAccess(): Result<void, DomainError> {
    for (const policy of ACCESS_POLICIES) {
      const result = policy(this)
      if (result) return result
    }
    return ok(undefined)
  }
}

const ACCESS_POLICIES: AccessPolicy[] = [
  p => p.status === 'suspended'    ? err(DomainError.PROPERTY_SUSPENDED())     : null,
  p => p.status === 'trial' && p.trialExpiresAt && p.trialExpiresAt < new Date() ? err(DomainError.PROPERTY_TRIAL_EXPIRED()) : null,
]