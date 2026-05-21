import { useTheme, recipes } from '../theme'

interface Props {
  k: string
  v: string
  last?: boolean
}

export function SummaryRow({ k, v, last }: Props) {
  const t = useTheme()
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10,
      padding: '7px 0', borderBottom: last ? 'none' : `1px solid ${t.color.hairSoft}`,
    }}>
      <span style={recipes.caption(t)}>{k}</span>
      <span style={{ fontSize: t.fontSize.base, fontWeight: t.fontWeight.medium, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
