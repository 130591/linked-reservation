import { Decimal } from 'decimal.js'
import { err, ok, Result } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { PaymentIntentStatus } from './payment-intent-status'

const TERMINAL_STATUSES = [PaymentIntentStatus.succeeded, PaymentIntentStatus.cancelled, PaymentIntentStatus.failed]

export class PaymentIntent {
  private constructor(
    readonly id:               string,
    readonly reservationId:    string,
    readonly providerIntentId: string,
    readonly amountCents:      Decimal,
    readonly currency:         string,
    readonly status:           PaymentIntentStatus,
    readonly confirmedAt:      Date | null,
  ) {}

  static create(
    id:               string,
    reservationId:    string,
    providerIntentId: string,
    amountCents:      number,
    currency:         string,
    status:           PaymentIntentStatus,
    confirmedAt:      Date | null = null,
  ): Result<PaymentIntent, DomainError> {
    if (new Decimal(amountCents).lessThanOrEqualTo(0)) {
      return err(DomainError.PAYMENT_DECLINED())
    }
    return ok(new PaymentIntent(id, reservationId, providerIntentId, new Decimal(amountCents), currency, status, confirmedAt))
  }

  confirm(): Result<PaymentIntent, DomainError> {
    if (this.status === PaymentIntentStatus.succeeded) {
      return ok(this)
    }
    if (this.isTerminal()) {
      return err(DomainError.PAYMENT_DECLINED())
    }
    return ok(new PaymentIntent(
      this.id,
      this.reservationId,
      this.providerIntentId,
      this.amountCents,
      this.currency,
      PaymentIntentStatus.succeeded,
      new Date(),
    ))
  }

  fail(): Result<PaymentIntent, DomainError> {
    if (this.isTerminal()) {
      return ok(this)
    }
    return ok(new PaymentIntent(
      this.id,
      this.reservationId,
      this.providerIntentId,
      this.amountCents,
      this.currency,
      PaymentIntentStatus.failed,
      this.confirmedAt,
    ))
  }

  cancel(): Result<PaymentIntent, DomainError> {
    if (this.isTerminal()) {
      return ok(this)
    }
    return ok(new PaymentIntent(
      this.id,
      this.reservationId,
      this.providerIntentId,
      this.amountCents,
      this.currency,
      PaymentIntentStatus.cancelled,
      this.confirmedAt,
    ))
  }

  isTerminal(): boolean {
    return TERMINAL_STATUSES.includes(this.status)
  }

  amountInMajorUnits(): Decimal {
    return this.amountCents.dividedBy(100)
  }
}
