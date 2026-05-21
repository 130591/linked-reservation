import { useQuery } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { useTheme, recipes } from '../theme'
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
  const t = useTheme()
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
      <div style={{ padding: t.space.xl, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <p style={{ color: t.color.muted, fontSize: t.fontSize.md }}>{intl.formatMessage({ id: 'loadingRooms' })}</p>
      </div>
    )
  }

  if (error instanceof SessionExpiredError) return null

  if (error || !rooms) {
    return (
      <div style={{ padding: t.space.xl }}>
        <p style={{ color: t.color.error, fontSize: t.fontSize.md }}>{intl.formatMessage({ id: 'errorLoadingRooms' })}</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={recipes.stepTitle(t)}>
          {intl.formatMessage({ id: 'chooseRoom' })}
        </div>
        <div style={{ ...recipes.subtitle(t), marginBottom: t.space.lg }}>
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
              border: `1px solid ${t.color.hair}`,
              borderRadius: t.radius.xl,
              background: t.color.bg,
              overflow: 'hidden',
            }}
          >
            <RoomPlaceholder hueA={room.hueA} hueB={room.hueB} label={room.name} height={170} variant="square" />
            <div style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ fontSize: t.fontSize.lg, fontWeight: t.fontWeight.semibold }}>{room.name}</div>
                {room.tag && <Pill>{room.tag}</Pill>}
              </div>
              <div style={{ fontSize: t.fontSize.base, color: t.color.muted, marginTop: 2, lineHeight: 1.4 }}>{room.short}</div>
              <div style={{
                marginTop: t.space.md, paddingTop: t.space.md, borderTop: `1px solid ${t.color.hairSoft}`,
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: 17, fontWeight: t.fontWeight.semibold }}>{brl(room.pricePerNight)}</span>
                  <span style={{ fontSize: 12, color: t.color.muted, marginLeft: t.space.xs }}>/ {intl.formatMessage({ id: 'perNight' })}</span>
                </div>
                <span
                  style={{
                    fontSize: 12, color: t.color.ink, fontWeight: t.fontWeight.medium,
                    display: 'inline-flex', alignItems: 'center', gap: t.space.xs,
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
