import {
  formatISODate,
  isBeforeISODate,
  isSameOrBeforeISODate,
  parseISODate,
} from '../../core/dates-validator'

describe('formatISODate', () => {
  describe('Given a UTC instant inside the same day in São Paulo (UTC-3)', () => {
    it('When formatted in America/Sao_Paulo, Then it returns YYYY-MM-DD for that local day', () => {
      const instant = new Date('2026-05-10T18:00:00.000Z')
      expect(formatISODate(instant, 'America/Sao_Paulo')).toBe('2026-05-10')
    })
  })

  describe('Given a UTC instant that crosses midnight relative to the local timezone', () => {
    it('When local time is still the previous day, Then the previous day is returned', () => {
      // 2026-05-11 02:30 UTC == 2026-05-10 23:30 BRT (UTC-3)
      const instant = new Date('2026-05-11T02:30:00.000Z')
      expect(formatISODate(instant, 'America/Sao_Paulo')).toBe('2026-05-10')
    })
  })

  describe('Given a single-digit month and day', () => {
    it('When formatted, Then the components are zero-padded to two digits', () => {
      const instant = new Date('2026-01-05T12:00:00.000Z')
      expect(formatISODate(instant, 'UTC')).toBe('2026-01-05')
    })
  })

  describe('Given UTC timezone', () => {
    it('When formatted, Then the date matches the UTC components', () => {
      const instant = new Date('2026-12-31T23:59:00.000Z')
      expect(formatISODate(instant, 'UTC')).toBe('2026-12-31')
    })
  })
})

describe('parseISODate', () => {
  describe('Given a well-formed real calendar date', () => {
    it('When parsed, Then a Dayjs instance is returned', () => {
      expect(parseISODate('2026-05-10')).not.toBeNull()
    })
  })

  describe('Given a string that matches the shape but is not a real date', () => {
    it('When the day exceeds the month length (2026-02-30), Then null is returned', () => {
      expect(parseISODate('2026-02-30')).toBeNull()
    })

    it('When the month is out of range (2026-13-01), Then null is returned', () => {
      expect(parseISODate('2026-13-01')).toBeNull()
    })
  })

  describe('Given a non-leap-year Feb 29', () => {
    it('When parsed, Then null is returned', () => {
      expect(parseISODate('2025-02-29')).toBeNull()
    })
  })

  describe('Given a leap-year Feb 29', () => {
    it('When parsed, Then it is accepted', () => {
      expect(parseISODate('2024-02-29')).not.toBeNull()
    })
  })

  describe('Given a malformed string', () => {
    it('When the format is wrong (10/05/2026), Then null is returned', () => {
      expect(parseISODate('10/05/2026')).toBeNull()
    })

    it('When the string is empty, Then null is returned', () => {
      expect(parseISODate('')).toBeNull()
    })
  })
})

describe('isBeforeISODate', () => {
  it('Given a is strictly before b, Then it returns true', () => {
    expect(isBeforeISODate('2026-05-10', '2026-05-11')).toBe(true)
  })

  it('Given a equals b, Then it returns false', () => {
    expect(isBeforeISODate('2026-05-10', '2026-05-10')).toBe(false)
  })

  it('Given a is after b, Then it returns false', () => {
    expect(isBeforeISODate('2026-05-12', '2026-05-10')).toBe(false)
  })

  it('Given an invalid input, Then it returns false', () => {
    expect(isBeforeISODate('2026-02-30', '2026-05-10')).toBe(false)
  })
})

describe('isSameOrBeforeISODate', () => {
  it('Given a equals b, Then it returns true', () => {
    expect(isSameOrBeforeISODate('2026-05-10', '2026-05-10')).toBe(true)
  })

  it('Given a is before b, Then it returns true', () => {
    expect(isSameOrBeforeISODate('2026-05-09', '2026-05-10')).toBe(true)
  })

  it('Given a is after b, Then it returns false', () => {
    expect(isSameOrBeforeISODate('2026-05-11', '2026-05-10')).toBe(false)
  })
})
