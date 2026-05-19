import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { SessionExpiredError } from '../api/client'

export function usePaymentStatus(intentId: string | null, onFailed: () => void): void {
  const { client } = useSession()
  const navigate = useNavigate()
  const activeRef = useRef(true)
  const onFailedRef = useRef(onFailed)
  onFailedRef.current = onFailed

  useEffect(() => {
    if (!intentId) return

    activeRef.current = true

    const poll = async () => {
      if (!activeRef.current) return
      try {
        const { status } = await client.getPaymentStatus(intentId)
        if (!activeRef.current) return

        if (status === 'succeeded') {
          activeRef.current = false
          const { viewToken } = await client.confirmBooking(intentId)
          const url = new URL(window.location.href)
          url.searchParams.set('token', viewToken)
          window.history.replaceState({}, '', url.toString())
          navigate('/booking/confirmation', { replace: true })
        } else if (status === 'failed' || status === 'cancelled') {
          activeRef.current = false
          onFailedRef.current()
        }
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          activeRef.current = false
          navigate('/booking/expired', { replace: true })
        }
        // Otherwise keep polling on transient errors
      }
    }

    const id = setInterval(poll, 3000)
    return () => {
      activeRef.current = false
      clearInterval(id)
    }
  }, [intentId])
}
