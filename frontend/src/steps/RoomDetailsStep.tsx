import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { useTheme, recipes } from '../theme'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { SectionLabel } from '../components/SectionLabel'
import { StickyFooter } from '../components/StickyFooter'
import { PrimaryBtn } from '../components/PrimaryBtn'
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
  const t = useTheme()
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
                  outline: isActive ? `2px solid ${t.color.ink}` : 'none',
                  outlineOffset: -2,
                  transition: 'opacity 120ms ease',
                }}
              />
            )
          })}
        </div>

        <div style={{ padding: '18px 20px 0' }}>
          {/* Back button */}
          <button onClick={onBack} style={recipes.backButton(t)}>
            <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
          </button>

          {/* Tag + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, marginBottom: t.space.xs }}>
            {room.tag && <Pill>{room.tag}</Pill>}
          </div>
          <div style={{ fontSize: t.fontSize.h1, lineHeight: 1.15, fontWeight: t.fontWeight.semibold, letterSpacing: -0.3 }}>
            {room.name}
          </div>
          <div style={{ fontSize: t.fontSize.base, color: t.color.muted, marginTop: t.space.xs }}>{room.short}</div>

          {/* Description */}
          {room.description && (
            <div style={{ marginTop: t.space.xl, paddingTop: t.space.lg, borderTop: `1px solid ${t.color.hair}` }}>
              <SectionLabel>{intl.formatMessage({ id: 'description' })}</SectionLabel>
              <p style={{ fontSize: t.fontSize.md, lineHeight: 1.55, margin: 0 }}>{room.description}</p>
            </div>
          )}

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div style={{ marginTop: t.space.xl - 2, paddingTop: t.space.lg, borderTop: `1px solid ${t.color.hair}` }}>
              <SectionLabel>{intl.formatMessage({ id: 'amenities' })}</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {room.amenities.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: t.space.sm, alignItems: 'center', fontSize: t.fontSize.base }}>
                    <span style={{ color: t.color.ink }}><Icon.check size={14} /></span>{a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" style={{ marginTop: t.space.lg, fontSize: 12, color: t.color.error }}>
              {error}
            </div>
          )}

          {/* Bottom spacing for sticky footer */}
          <div style={{ height: 80 }} />
        </div>
      </div>

      <StickyFooter>
        <div style={{ flex: 1 }}>
          <div style={recipes.caption(t)}>
            {nights} × {intl.formatMessage({ id: 'night' })}
          </div>
          <div style={{ fontSize: t.fontSize.xl, fontWeight: t.fontWeight.semibold }}>{brl(totalCents)}</div>
        </div>
        <PrimaryBtn onClick={handleReserve} disabled={selectMutation.isPending}>
          {intl.formatMessage({ id: 'reserveBtn' })}
        </PrimaryBtn>
      </StickyFooter>
    </div>
  )
}
