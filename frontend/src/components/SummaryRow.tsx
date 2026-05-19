import { D1 } from './theme'

interface Props {
  k: string
  v: string
  last?: boolean
}

export function SummaryRow({ k, v, last }: Props) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10,
      padding: '7px 0', borderBottom: last ? 'none' : `1px solid ${D1.hairSoft}`,
    }}>
      <span style={{ fontSize: 11, color: D1.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 500 }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
