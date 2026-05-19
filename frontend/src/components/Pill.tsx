import type { ReactNode } from 'react'
import { D1 } from './theme'

interface Props {
  children: ReactNode
}

export function Pill({ children }: Props) {
  return (
    <span style={{
      background: D1.surface, color: D1.ink,
      padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
      letterSpacing: 0.3, border: `1px solid ${D1.hair}`,
    }}>
      {children}
    </span>
  )
}
