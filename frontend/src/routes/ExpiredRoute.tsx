import { useIntl } from 'react-intl'
import { D1 } from '../components/theme'

export function ExpiredRoute() {
  const intl = useIntl()

  return (
    <div
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
      <div style={{ fontSize: 40, marginBottom: 16 }}>⏱</div>
      <h1
        style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.2, marginBottom: 8 }}
      >
        {intl.formatMessage({ id: 'sessionExpiredTitle' })}
      </h1>
      <p style={{ fontSize: 14, color: D1.muted, maxWidth: 280, lineHeight: 1.5, margin: '0 0 24px' }}>
        {intl.formatMessage({ id: 'sessionExpiredSub' })}
      </p>
    </div>
  )
}
