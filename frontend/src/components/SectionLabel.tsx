import type { ReactNode } from 'react'
import { D1 } from './theme'

interface Props {
  children: ReactNode
}

export function SectionLabel({ children }: Props) {
  return (
    <div style={{ fontSize: 10, color: D1.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 500, marginBottom: 10 }}>
      {children}
    </div>
  )
}
