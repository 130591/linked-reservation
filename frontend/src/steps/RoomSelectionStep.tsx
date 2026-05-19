import { useQuery } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { D1 } from '../components/theme'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { RoomPlaceholder } from '../components/RoomPlaceholder'
import { useSession } from '../context/SessionContext'
import { useBooking } from '../context/BookingContext'
import { SessionExpiredError } from '../api/client'
import type { Room } from '../types'

interface Props {
  onNext: () => void
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function RoomSelectionStep({ onNext }: Props) {
  const intl = useIntl()
  const { client } = useSession()
  const { setSelectedRoom } = useBooking()

  const { data: rooms, isLoading, error } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => client.getRooms(),
    staleTime: 30_000,
  })

  const handleSelect = (room: Room) => {
    setSelectedRoom(room)
    onNext()
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <p style={{ color: D1.muted, fontSize: 14 }}>{intl.formatMessage({ id: 'loadingRooms' })}</p>
      </div>
    )
  }

  // Session expired — global handler is navigating to /booking/expired; render nothing in the meantime
  if (error instanceof SessionExpiredError) return null

  if (error || !rooms) {
    return (
      <div style={{ padding: '20px' }}>
        <p style={{ color: '#c0392b', fontSize: 14 }}>{intl.formatMessage({ id: 'errorLoadingRooms' })}</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: -0.2 }}>
          {intl.formatMessage({ id: 'chooseRoom' })}
        </div>
        <div style={{ fontSize: 13, color: D1.muted, marginTop: 4, marginBottom: 16 }}>
          {intl.formatMessage({ id: 'chooseRoomSub' })}
        </div>
      </div>

      <div style={{ padding: '0 20px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => handleSelect(room)}
            style={{
              cursor: 'pointer',
              border: `1px solid ${D1.hair}`,
              borderRadius: 12,
              background: D1.bg,
              overflow: 'hidden',
            }}
          >
            <RoomPlaceholder hueA={room.hueA} hueB={room.hueB} label={room.name} height={170} variant="square" />
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{room.name}</div>
                {room.tag && <Pill>{room.tag}</Pill>}
              </div>
              <div style={{ fontSize: 13, color: D1.muted, marginTop: 2, lineHeight: 1.4 }}>{room.short}</div>
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D1.hairSoft}`,
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: 600 }}>{brl(room.pricePerNight)}</span>
                  <span style={{ fontSize: 12, color: D1.muted, marginLeft: 4 }}>/ {intl.formatMessage({ id: 'perNight' })}</span>
                </div>
                <span
                  style={{
                    fontSize: 12, color: D1.ink, fontWeight: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {intl.formatMessage({ id: 'continueBtn' })} <Icon.arrow size={12} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
