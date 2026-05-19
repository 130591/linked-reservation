import type { ReactNode } from 'react'
import { D1 } from './theme'

interface Props {
  children: ReactNode
}

export function StickyFooter({ children }: Props) {
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0,
      padding: '12px 20px 14px',
      background: D1.bg,
      borderTop: `1px solid ${D1.hair}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {children}
    </div>
  )
}
