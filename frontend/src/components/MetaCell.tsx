import { D1 } from './theme'

interface Props {
  k: string
  v: string
}

export function MetaCell({ k, v }: Props) {
  return (
    <div>
      <div style={{ fontSize: 10, color: D1.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 500 }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div>
    </div>
  )
}
