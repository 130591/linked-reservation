import type { ReactNode } from 'react'
import { useTheme } from '../theme'

interface Props {
  children: ReactNode
}

export function StickyFooter({ children }: Props) {
  const t = useTheme()
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0,
      padding: '12px 20px 14px',
      background: t.color.bg,
      borderTop: `1px solid ${t.color.hair}`,
      display: 'flex', alignItems: 'center', gap: t.space.md,
    }}>
      {children}
    </div>
  )
}
