import type { ReactNode } from 'react'
import { D1 } from './theme'

interface Props {
  children: ReactNode
  onClick?: () => void
  full?: boolean
}

export function SecondaryBtn({ children, onClick, full }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? '100%' : undefined,
        padding: '11px 18px', border: `1px solid ${D1.hair}`, borderRadius: 10,
        background: 'transparent', color: D1.ink, cursor: 'pointer',
        fontSize: 13, fontWeight: 500,
      }}
    >
      {children}
    </button>
  )
}
