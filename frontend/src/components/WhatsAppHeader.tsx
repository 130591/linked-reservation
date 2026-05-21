import { useIntl } from 'react-intl'
import { useTheme } from '../theme'
import { Icon } from './Icon'

interface Props {
  host: string
  onBack?: () => void
  tone?: 'light' | 'dark'
}

export function WhatsAppHeader({ host, onBack, tone = 'light' }: Props) {
  const intl = useIntl()
  const t = useTheme()
  const ink = tone === 'dark' ? '#f6f1e7' : '#2a231c'
  const bg = tone === 'dark' ? 'rgba(22,18,14,0.85)' : 'rgba(255,252,246,0.85)'
  const border = tone === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(42,35,28,0.08)'
  const muted = tone === 'dark' ? 'rgba(246,241,231,0.6)' : 'rgba(42,35,28,0.55)'

  const initials = host.split(' ').map(w => w[0]).slice(0, 2).join('')

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 20,
        padding: '10px 16px 10px 12px',
        background: bg,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label={intl.formatMessage({ id: 'backBtn' })}
          style={{
            border: 0, background: 'transparent', color: ink, padding: t.space.xs, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 2,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, oklch(0.78 0.08 60), oklch(0.62 0.10 40))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: t.fontSize.base, fontWeight: t.fontWeight.semibold, letterSpacing: 0.3,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
        <div style={{ fontSize: t.fontSize.xs, color: muted, fontFamily: t.font.mono, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {intl.formatMessage({ id: 'continuing' })}
        </div>
        <div style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {host}
        </div>
      </div>
      <div style={{ color: muted, display: 'flex', alignItems: 'center', gap: t.space.xs, fontSize: t.fontSize.xs, fontFamily: t.font.mono }}>
        <Icon.lock size={11} />
        <span>SSL</span>
      </div>
    </div>
  )
}
