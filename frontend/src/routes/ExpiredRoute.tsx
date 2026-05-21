import { useIntl } from 'react-intl'
import { useTheme, recipes } from '../theme'

export function ExpiredRoute() {
  const intl = useIntl()
  const t = useTheme()

  return (
    <div
      style={{
        ...recipes.pageShell(t),
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: t.space.lg }}>⏱</div>
      <h1 style={{ ...recipes.stepTitle(t), marginBottom: t.space.sm }}>
        {intl.formatMessage({ id: 'sessionExpiredTitle' })}
      </h1>
      <p style={{ fontSize: t.fontSize.md, color: t.color.muted, maxWidth: 280, lineHeight: 1.5, margin: '0 0 24px' }}>
        {intl.formatMessage({ id: 'sessionExpiredSub' })}
      </p>
    </div>
  )
}
