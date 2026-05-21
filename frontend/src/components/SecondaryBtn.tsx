import type { ReactNode } from 'react'
import { useTheme } from '../theme'

interface Props {
  children: ReactNode
  onClick?: () => void
  full?: boolean
}

export function SecondaryBtn({ children, onClick, full }: Props) {
  const t = useTheme()
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? '100%' : undefined,
        padding: '11px 18px', border: `1px solid ${t.color.hair}`, borderRadius: t.radius.lg,
        background: 'transparent', color: t.color.ink, cursor: 'pointer',
        fontSize: t.fontSize.base, fontWeight: t.fontWeight.medium,
      }}
    >
      {children}
    </button>
  )
}
