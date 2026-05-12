import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

const ISO_DATE_FORMAT = 'YYYY-MM-DD'

export function formatISODate(date: Date, tz: string): string {
  return dayjs(date).tz(tz).format(ISO_DATE_FORMAT)
}

// Strict calendar-date parse: rejects shapes that pass a regex but aren't real
// dates (e.g. 2026-02-30, 2026-13-01). Returns null on failure so callers can
// branch without throwing.
export function parseISODate(value: string): dayjs.Dayjs | null {
  const parsed = dayjs(value, ISO_DATE_FORMAT, true)
  return parsed.isValid() ? parsed : null
}

export function isBeforeISODate(a: string, b: string): boolean {
  const da = parseISODate(a)
  const db = parseISODate(b)
  return !!da && !!db && da.isBefore(db, 'day')
}

export function isSameOrBeforeISODate(a: string, b: string): boolean {
  const da = parseISODate(a)
  const db = parseISODate(b)
  return !!da && !!db && (da.isSame(db, 'day') || da.isBefore(db, 'day'))
}

export function formatYYMM(date: Date): string {
  return dayjs(date).format('YYMM')
}
