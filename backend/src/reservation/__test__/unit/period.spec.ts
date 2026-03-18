import { Period } from "@/reservation/core/domain"
import { DomainError } from "@/reservation/core/domain/erros"


describe('Period', () => {
  it('should create a period successfully', () => {
    const startDate = new Date('2030-03-01T10:00:00.000Z')
    const endDate = new Date('2030-03-02T10:00:00.000Z') // Exactly 1 day

    const result = Period.create(startDate, endDate)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value).toBeInstanceOf(Period)
  })

  it('should not create a period if check-in is in the past', () => {
    const pastDate = new Date('2020-01-01T10:00:00.000Z')
    const futureDate = new Date('2030-01-01T10:00:00.000Z')

    const result = Period.create(pastDate, futureDate)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toEqual(DomainError.CHECK_IN_IN_PAST())
  })

  it('should not create a period if check-out is before or equal to check-in', () => {
    const startDate = new Date('2030-03-01T10:00:00.000Z')
    const endDate = new Date('2030-03-01T09:00:00.000Z') // Before

    const result = Period.create(startDate, endDate)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toEqual(DomainError.CHECK_OUT_BEFORE_CHECK_IN())
  })

  it('should not create a period if duration is less than 1 day', () => {
    const startDate = new Date('2030-03-01T10:00:00.000Z')
    const endDate = new Date('2030-03-01T15:00:00.000Z') // Only 5 hours

    const result = Period.create(startDate, endDate)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toEqual(DomainError.MINIMUM_DURATION_NOT_MET())
  })

  it('should not create a period if max staying days is exceeded', () => {
    const startDate = new Date('2030-03-01T00:00:00.000Z')
    const endDate = new Date('2030-04-02T00:00:00.000Z') // 32 days later

    const result = Period.create(startDate, endDate)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toEqual(DomainError.MAX_STAYING_DAYS_EXCEEDED(32, 30))
  })
})