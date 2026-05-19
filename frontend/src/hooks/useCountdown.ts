import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export interface CountdownResult {
  remainingSeconds: number
  hasExpired: boolean
}

export function useCountdown(expiresAt: Date | null): CountdownResult {
  const navigate = useNavigate()
  const navigatedRef = useRef(false)

  const getRemaining = () =>
    expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0

  const [remainingSeconds, setRemainingSeconds] = useState(getRemaining)

  useEffect(() => {
    if (!expiresAt) return

    const tick = () => {
      const remaining = getRemaining()
      setRemainingSeconds(remaining)
      if (remaining === 0 && !navigatedRef.current) {
        navigatedRef.current = true
        navigate('/booking/expired', { replace: true })
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])

  return { remainingSeconds, hasExpired: remainingSeconds === 0 && expiresAt !== null }
}
