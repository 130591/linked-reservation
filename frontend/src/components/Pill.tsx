import type { ReactNode } from 'react'
import { useTheme } from '../theme'

interface Props {
  children: ReactNode
}

export function Pill({ children }: Props) {
  const t = useTheme()
  return (
    <span style={{
      background: t.color.surface, color: t.color.ink,
      padding: '3px 8px', borderRadius: t.radius.pill, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.semibold,
      letterSpacing: 0.3, border: `1px solid ${t.color.hair}`,
    }}>
      {children}
    </span>
  )
}
