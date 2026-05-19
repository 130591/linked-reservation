import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { D1 } from '../components/theme'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { SectionLabel } from '../components/SectionLabel'
import { StickyFooter } from '../components/StickyFooter'
import { RoomPlaceholder } from '../components/RoomPlaceholder'
import { useSession } from '../context/SessionContext'
import { useBooking } from '../context/BookingContext'
import { ApiError } from '../api/client'

interface Props {
  onNext: () => void
  onBack: () => void
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function RoomDetailsStep({ onNext, onBack }: Props) {
  const intl = useIntl()
  const { client } = useSession()
  const { selectedRoom, setReservationId } = useBooking()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  const selectMutation = useMutation({
    mutationFn: (roomId: string) => client.selectRoom(roomId),
  })

  const handleReserve = async () => {
    if (!selectedRoom) return
    setError(null)
    try {
      const data = await selectMutation.mutateAsync(selectedRoom.id)
      setReservationId(data.reservationId)
      qc.invalidateQueries({ queryKey: ['rooms'] })
      onNext()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ROOM_NOT_AVAILABLE') {
        setError(intl.formatMessage({ id: 'errorRoomNotAvailable' }))
      }
    }
  }

  if (!selectedRoom) return null

  const room = selectedRoom
  // Backend sends price in cents; the sketch uses whole numbers
  const nights = 2 // TODO: derive from session/booking period
  const totalCents = room.pricePerNight * nights

  const baseHueA = room.hueA ?? 30
  const baseHueB = room.hueB ?? 50
  const heroHueA = baseHueA + activePhoto * 12
  const heroHueB = baseHueB + activePhoto * 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Hero image */}
        <RoomPlaceholder hueA={heroHueA} hueB={heroHueB} label={room.name} height={240} variant="square" />

        {/* Thumbnail strip */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2, 3].map(i => {
            const isActive = i === activePhoto
            return (
              <button
                key={i}
                type="button"
                aria-label={`photo ${i + 1}`}
                aria-pressed={isActive}
                onClick={() => setActivePhoto(i)}
                style={{
                  flex: 1,
                  height: 48,
                  padding: 0,
                  border: 0,
                  cursor: 'pointer',
                  background: `linear-gradient(135deg, oklch(${0.72 - i * 0.03} 0.08 ${baseHueA + i * 12}), oklch(${0.58 - i * 0.02} 0.09 ${baseHueB + i * 10}))`,
                  opacity: isActive ? 1 : 0.55,
                  outline: isActive ? `2px solid ${D1.ink}` : 'none',
                  outlineOffset: -2,
                  transition: 'opacity 120ms ease',
                }}
              />
            )
          })}
        </div>

        <div style={{ padding: '18px 20px 0' }}>
          {/* Back button */}
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
              color: D1.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
              marginBottom: 16,
            }}
          >
            <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
          </button>

          {/* Tag + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {room.tag && <Pill>{room.tag}</Pill>}
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 600, letterSpacing: -0.3 }}>
            {room.name}
          </div>
          <div style={{ fontSize: 13, color: D1.muted, marginTop: 4 }}>{room.short}</div>

          {/* Description */}
          {room.description && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${D1.hair}` }}>
              <SectionLabel>{intl.formatMessage({ id: 'description' })}</SectionLabel>
              <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{room.description}</p>
            </div>
          )}

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${D1.hair}` }}>
              <SectionLabel>{intl.formatMessage({ id: 'amenities' })}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {room.amenities.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: D1.ink }}><Icon.check size={14} /></span>{a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" style={{ marginTop: 16, fontSize: 12, color: '#c0392b' }}>
              {error}
            </div>
          )}

          {/* Bottom spacing for sticky footer */}
          <div style={{ height: 80 }} />
        </div>
      </div>

      <StickyFooter>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: D1.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 500 }}>
            {nights} × {intl.formatMessage({ id: 'night' })}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{brl(totalCents)}</div>
        </div>
        <button
          onClick={handleReserve}
          disabled={selectMutation.isPending}
          style={{
            padding: '13px 20px', border: 0, borderRadius: 10,
            background: selectMutation.isPending ? 'rgba(17,17,17,0.2)' : D1.accent,
            color: D1.accentInk,
            cursor: selectMutation.isPending ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {intl.formatMessage({ id: 'reserveBtn' })}
        </button>
      </StickyFooter>
    </div>
  )
}
