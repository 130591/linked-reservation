import type { ReactNode } from 'react'
import { useTheme } from '../theme'

interface Props {
  children: ReactNode
  onClick?: () => void
  full?: boolean
  disabled?: boolean
}

export function PrimaryBtn({ children, onClick, full, disabled }: Props) {
  const t = useTheme()
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? '100%' : undefined,
        padding: '13px 20px', border: 0, borderRadius: t.radius.lg,
        background: disabled ? 'rgba(17,17,17,0.2)' : t.color.accent,
        color: t.color.accentInk,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, letterSpacing: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      {children}
    </button>
  )
}
