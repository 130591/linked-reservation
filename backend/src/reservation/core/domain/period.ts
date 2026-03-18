import { Err, Ok, Result } from 'neverthrow'
import { DomainError } from './erros/ErrorDomain'

export class Period {
  private readonly duration: number;

  private constructor(
    private readonly startDate: Date,
    private readonly endDate: Date,
    private readonly maxStayingDays: number = 30,
  ) {
    this.duration = this.endDate.getTime() - this.startDate.getTime()
  }

  getStartDate(): Date {
    return this.startDate
  }

  getEndDate(): Date {
    return this.endDate
  }

  static create(startDate: Date, endDate: Date, maxStayingDays = 30): Result<Period, DomainError> {
    return this.validateCheckInNotInPast(startDate)
      .andThen(() => this.validateCheckOutAfterCheckIn(startDate, endDate))
      .andThen((durationMs) => this.validateDuration(durationMs, maxStayingDays))
      .map(() => new Period(startDate, endDate, maxStayingDays))
  }

  private static convertToDays(ms: number): number {
    return ms / (1000 * 60 * 60 * 24)
  }

  private static validateCheckInNotInPast(startDate: Date): Result<void, DomainError> {
    return startDate < new Date()
      ? new Err(DomainError.CHECK_IN_IN_PAST())
      : new Ok(undefined)
  }

  private static validateCheckOutAfterCheckIn(startDate: Date, endDate: Date): Result<number, DomainError> {
    const durationMs = endDate.getTime() - startDate.getTime()
    return durationMs <= 0
      ? new Err(DomainError.CHECK_OUT_BEFORE_CHECK_IN())
      : new Ok(durationMs)
  }

  private static validateDuration(durationMs: number, maxStayingDays: number): Result<void, DomainError> {
    const days = this.convertToDays(durationMs)

    if (days < 1) {
      return new Err(DomainError.MINIMUM_DURATION_NOT_MET())
    }

    if (days > maxStayingDays) {
      return new Err(DomainError.MAX_STAYING_DAYS_EXCEEDED(days, maxStayingDays))
    }

    return new Ok(undefined)
  }
}