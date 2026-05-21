import { useTheme, recipes } from '../theme'

interface Props {
  k: string
  v: string
}

export function MetaCell({ k, v }: Props) {
  const t = useTheme()
  return (
    <div>
      <div style={recipes.caption(t)}>{k}</div>
      <div style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, marginTop: 2 }}>{v}</div>
    </div>
  )
}
