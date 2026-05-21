import { useTheme } from '../theme'

interface Props {
  step: number
  total?: number
  accent?: string
  dim?: string
}

export function StepDots({ step, total = 5, accent, dim }: Props) {
  const t = useTheme()
  const accentColor = accent ?? t.color.accent
  const dimColor = dim ?? t.color.hair

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            width: i === step ? 22 : 10,
            borderRadius: 2,
            background: i <= step ? accentColor : dimColor,
            transition: 'width 0.3s, background 0.3s',
          }}
        />
      ))}
    </div>
  )
}
