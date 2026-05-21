import type { ReactNode } from 'react'
import { useTheme, recipes } from '../theme'

interface Props {
  children: ReactNode
}

export function SectionLabel({ children }: Props) {
  const t = useTheme()
  return (
    <div style={{ ...recipes.caption(t), marginBottom: 10 }}>
      {children}
    </div>
  )
}
