import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { useSession } from '../context/SessionContext'
import { D1 } from '../components/theme'
import { WhatsAppHeader } from '../components/WhatsAppHeader'
import { Icon } from '../components/Icon'
import { SummaryRow } from '../components/SummaryRow'
import { StickyFooter } from '../components/StickyFooter'
import { PrimaryBtn } from '../components/PrimaryBtn'
import { SecondaryBtn } from '../components/SecondaryBtn'
import { PhoneSheet } from '../components/PhoneSheet'
import { buildWhatsAppUrl } from '../utils/whatsapp'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(date)
    .replace('.', '')
}

function formatBRL(amountInCents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    amountInCents / 100,
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function icsFormat(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  )
}

function buildIcsBlobUrl(input: {
  start: Date
  end: Date
  summary: string
  description: string
  location: string
  uid: string
}): string {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Linked Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${icsFormat(new Date())}`,
    `DTSTART:${icsFormat(input.start)}`,
    `DTEND:${icsFormat(input.end)}`,
    `SUMMARY:${input.summary}`,
    `DESCRIPTION:${input.description}`,
    `LOCATION:${input.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
}

function CalGlyph({ type }: { type: 'google' | 'apple' | 'outlook' | 'ics' }) {
  if (type === 'google') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2" y="3" width="14" height="13" rx="2" fill="#fff" stroke="#111" strokeWidth="1" />
        <rect x="2" y="3" width="14" height="3" fill="#4285f4" />
        <text x="9" y="13" fontSize="6" fontWeight="700" textAnchor="middle" fill="#4285f4">31</text>
      </svg>
    )
  }
  if (type === 'apple') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2" y="3" width="14" height="13" rx="2" fill="#fff" stroke="#111" />
        <rect x="2" y="3" width="14" height="3" fill="#e53935" />
        <text x="9" y="13" fontSize="6" fontWeight="700" textAnchor="middle" fill="#111">31</text>
      </svg>
    )
  }
  if (type === 'outlook') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="2" y="3" width="14" height="13" rx="2" fill="#0078d4" />
        <text x="9" y="13" fontSize="7" fontWeight="700" textAnchor="middle" fill="#fff">O</text>
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <rect x="3" y="2" width="11" height="14" rx="1.5" fill="#fff" stroke="#111" />
      <path d="M6 6h5M6 9h5M6 12h3" stroke="#111" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function TokenErrorScreen() {
  const intl = useIntl()
  return (
    <div
      data-testid="token-error-screen"
      style={{
        height: '100%',
        background: D1.bg,
        color: D1.ink,
        fontFamily: D1.sans,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.2, marginBottom: 8 }}>
        {intl.formatMessage({ id: 'tokenErrorTitle' })}
      </h1>
      <p style={{ fontSize: 14, color: D1.muted, maxWidth: 280, lineHeight: 1.5, margin: 0 }}>
        {intl.formatMessage({ id: 'tokenErrorSub' })}
      </p>
    </div>
  )
}

export function ConfirmationRoute() {
  const { client } = useSession()
  const intl = useIntl()
  const [calOpen, setCalOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['confirmation'],
    queryFn: () => client.getConfirmation(),
    retry: false,
  })

  const icsUrl = useMemo(() => {
    if (!data) return null
    return buildIcsBlobUrl({
      start: new Date(data.period.checkIn),
      end: new Date(data.period.checkOut),
      summary: `${intl.formatMessage({ id: 'eventTitle' })} · ${data.property.name}`,
      description: `${data.room.name} — ${intl.formatMessage({ id: 'bookingCode' })}: ${data.bookingReference}`,
      location: data.property.name,
      uid: `${data.bookingReference}@linkedreservation`,
    })
  }, [data, intl])

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          background: D1.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: D1.muted }}>...</div>
      </div>
    )
  }

  if (error || !data) {
    return <TokenErrorScreen />
  }

  const waUrl = buildWhatsAppUrl(
    data.property.whatsappNumber,
    intl.formatMessage({ id: 'whatsappGreeting' }, { ref: data.bookingReference }),
  )

  const peopleUnit = data.guests === 1
    ? intl.formatMessage({ id: 'person' })
    : intl.formatMessage({ id: 'people' })

  return (
    <div
      style={{
        height: '100%',
        background: D1.bg,
        color: D1.ink,
        fontFamily: D1.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <WhatsAppHeader host={data.property.name} />

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 20px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            margin: '4px auto 16px',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: D1.accent,
            color: D1.accentInk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.check size={24} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.2, margin: 0 }}>
          {intl.formatMessage({ id: 'confirmedTitle' })}
        </h1>
        <p style={{ fontSize: 13, color: D1.muted, marginTop: 6, maxWidth: 280, margin: '6px auto 0' }}>
          {intl.formatMessage({ id: 'confirmedSub' })}
        </p>

        <div
          style={{
            margin: '22px 0',
            border: `1px solid ${D1.hair}`,
            borderRadius: 10,
            padding: '14px',
            background: D1.surface,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              paddingBottom: 12,
              borderBottom: `1px solid ${D1.hair}`,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: D1.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 500,
              }}
            >
              {intl.formatMessage({ id: 'bookingCode' })}
            </div>
            <div
              data-testid="booking-reference"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, marginTop: 4 }}
            >
              {data.bookingReference}
            </div>
          </div>

          <SummaryRow k={intl.formatMessage({ id: 'reservedFor' })} v={data.guest.name} />
          <SummaryRow k={data.property.name} v={data.room.name} />
          <SummaryRow
            k={`${intl.formatMessage({ id: 'checkin' })} → ${intl.formatMessage({ id: 'checkout' })}`}
            v={`${formatDate(data.period.checkIn)} → ${formatDate(data.period.checkOut)}`}
          />
          <SummaryRow
            k={intl.formatMessage({ id: 'guests' })}
            v={`${data.guests} ${peopleUnit}`}
            last
          />
        </div>

        <div style={{ fontSize: 12, color: D1.muted, textAlign: 'center' }}>
          {intl.formatMessage({ id: 'totalLabel' })}: <strong style={{ color: D1.ink }}>{formatBRL(data.totalPaid.amount)}</strong>
        </div>
      </div>

      <StickyFooter>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryBtn full onClick={() => window.open(waUrl, '_blank')}>
            <Icon.whatsapp size={14} /> {intl.formatMessage({ id: 'backToChat' })}
          </PrimaryBtn>
          <SecondaryBtn full onClick={() => setCalOpen(true)}>
            {intl.formatMessage({ id: 'addToCalendar' })}
          </SecondaryBtn>
        </div>
      </StickyFooter>

      <PhoneSheet open={calOpen} onClose={() => setCalOpen(false)} bg={D1.bg} ink={D1.ink}>
        <div style={{ padding: '4px 0 0' }}>
          <div style={{ padding: '0 20px 10px' }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>
              {intl.formatMessage({ id: 'calendarTitle' })}
            </div>
            <div style={{ fontSize: 12, color: D1.muted, marginTop: 2 }}>
              {intl.formatMessage({ id: 'calendarSub' })}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${D1.hairSoft}` }}>
            <CalRow icon={<CalGlyph type="google" />} label={intl.formatMessage({ id: 'googleCal' })} href={buildGoogleCalUrl(data)} />
            <CalRow icon={<CalGlyph type="apple" />} label={intl.formatMessage({ id: 'appleCal' })} href={icsUrl ?? '#'} download="linked-reservation.ics" />
            <CalRow icon={<CalGlyph type="outlook" />} label={intl.formatMessage({ id: 'outlookCal' })} href={buildOutlookUrl(data)} />
            <CalRow icon={<CalGlyph type="ics" />} label={intl.formatMessage({ id: 'downloadIcs' })} href={icsUrl ?? '#'} download="linked-reservation.ics" />
          </div>
          <div style={{ padding: '12px 20px 0' }}>
            <button
              onClick={() => setCalOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                border: 0,
                borderRadius: 10,
                background: 'transparent',
                color: D1.muted,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {intl.formatMessage({ id: 'cancel' })}
            </button>
          </div>
        </div>
      </PhoneSheet>
    </div>
  )
}

function CalRow({ icon, label, href, download }: { icon: React.ReactNode; label: string; href: string; download?: string }) {
  return (
    <a
      href={href}
      target={download ? undefined : '_blank'}
      rel={download ? undefined : 'noreferrer noopener'}
      download={download}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: D1.bg,
        textDecoration: 'none',
        borderBottom: `1px solid ${D1.hairSoft}`,
        color: D1.ink,
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: D1.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</div>
      <Icon.arrow size={13} />
    </a>
  )
}

function gcalFormat(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  )
}

function buildGoogleCalUrl(data: {
  period: { checkIn: string; checkOut: string }
  property: { name: string }
  room: { name: string }
  bookingReference: string
}): string {
  const start = gcalFormat(new Date(data.period.checkIn))
  const end = gcalFormat(new Date(data.period.checkOut))
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Check-in · ${data.property.name}`,
    dates: `${start}/${end}`,
    details: `${data.room.name} — ${data.bookingReference}`,
    location: data.property.name,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildOutlookUrl(data: {
  period: { checkIn: string; checkOut: string }
  property: { name: string }
  room: { name: string }
  bookingReference: string
}): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `Check-in · ${data.property.name}`,
    startdt: data.period.checkIn,
    enddt: data.period.checkOut,
    body: `${data.room.name} — ${data.bookingReference}`,
    location: data.property.name,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
