import { useTheme } from '../theme'

interface Props {
  hueA?: number
  hueB?: number
  label?: string
  height?: number
  variant?: 'default' | 'square'
}

export function RoomPlaceholder({ hueA = 30, hueB = 50, label = 'room photo', height = 180, variant = 'default' }: Props) {
  const t = useTheme()
  const bg = `linear-gradient(135deg, oklch(0.72 0.08 ${hueA}), oklch(0.58 0.09 ${hueB}))`
  const stripe = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 12px)'
  const radius = variant === 'square' ? 0 : t.radius.xl + 2

  return (
    <div
      aria-label={label}
      role="img"
      style={{
        height,
        width: '100%',
        borderRadius: radius,
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        color: 'rgba(255,255,255,0.82)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: stripe }} />
      <div
        style={{
          position: 'absolute', top: '22%', right: '18%',
          width: height * 0.28, height: height * 0.28, borderRadius: '50%',
          background: 'rgba(255,245,220,0.45)',
          boxShadow: '0 0 40px rgba(255,230,180,0.3)',
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: 10, left: 12,
          fontFamily: t.font.mono,
          fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        ▌ {label}
      </div>
    </div>
  )
}
