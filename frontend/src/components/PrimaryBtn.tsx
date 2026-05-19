import type { ReactNode } from 'react'
import { D1 } from './theme'

interface Props {
  children: ReactNode
  onClick?: () => void
  full?: boolean
  disabled?: boolean
}

export function PrimaryBtn({ children, onClick, full, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? '100%' : undefined,
        padding: '13px 20px', border: 0, borderRadius: 10,
        background: disabled ? 'rgba(17,17,17,0.2)' : D1.accent,
        color: D1.accentInk,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14, fontWeight: 600, letterSpacing: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      {children}
    </button>
  )
}
