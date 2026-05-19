import { Suspense, lazy, useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { D1 } from '../components/theme'
import { Icon } from '../components/Icon'
import { PrimaryBtn } from '../components/PrimaryBtn'
import { useSession } from '../context/SessionContext'
import { useBooking } from '../context/BookingContext'
import { usePaymentStatus } from '../hooks/usePaymentStatus'

const StripeFormLazy = lazy(() => import('./StripeForm'))

interface Props {
  onBack: () => void
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function PaymentStep({ onBack }: Props) {
  const intl = useIntl()
  const { client } = useSession()
  const { selectedRoom, reservationId, guestDetails } = useBooking()

  const [intentId, setIntentId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [publishableKey, setPublishableKey] = useState<string | null>(null)
  const [paymentFailed, setPaymentFailed] = useState(false)

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!reservationId || !guestDetails) throw new Error('Missing booking context')
      return client.createPaymentIntent({
        reservationId,
        guestName: guestDetails.name,
        guestEmail: guestDetails.email,
        guestPhone: guestDetails.phone,
      })
    },
    onSuccess: (data) => {
      setIntentId(data.intentId)
      setClientSecret(data.clientSecret)
      setPublishableKey(data.publishableKey)
      setPaymentFailed(false)
    },
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { createMutation.mutate() }, [])

  usePaymentStatus(intentId, () => setPaymentFailed(true))

  const handleRetry = () => {
    setIntentId(null)
    setClientSecret(null)
    setPublishableKey(null)
    setPaymentFailed(false)
    createMutation.mutate()
  }

  if (paymentFailed) {
    return (
      <div style={{ padding: '18px 20px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            color: D1.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
          }}
        >
          <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
        </button>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.2 }}>
          {intl.formatMessage({ id: 'paymentFailed' })}
        </div>
        <div style={{ fontSize: 13, color: D1.muted, marginTop: 4, marginBottom: 24 }}>
          {intl.formatMessage({ id: 'paymentFailedSub' })}
        </div>
        <PrimaryBtn onClick={handleRetry} full>
          {intl.formatMessage({ id: 'retryPayment' })}
        </PrimaryBtn>
      </div>
    )
  }

  if (createMutation.isError) {
    return (
      <div style={{ padding: '18px 20px' }}>
        <div role="alert" style={{ color: '#c0392b', fontSize: 14 }}>
          {intl.formatMessage({ id: 'errorCreatingPayment' })}
        </div>
        <button
          onClick={() => createMutation.mutate()}
          style={{ marginTop: 12, background: 'transparent', border: `1px solid ${D1.hair}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}
        >
          {intl.formatMessage({ id: 'retryPayment' })}
        </button>
      </div>
    )
  }

  const isLoading = createMutation.isPending || (!clientSecret && !createMutation.isError)

  if (isLoading) {
    return (
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: D1.muted, fontSize: 14 }}>{intl.formatMessage({ id: 'creatingPayment' })}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '18px 20px 100px' }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
          color: D1.muted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16,
        }}
      >
        <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
      </button>

      <div style={{ fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: -0.2 }}>
        {intl.formatMessage({ id: 'paymentTitle' })}
      </div>
      <div style={{ fontSize: 13, color: D1.muted, marginTop: 4, marginBottom: 18 }}>
        {intl.formatMessage({ id: 'paymentSub' })}
      </div>

      {selectedRoom && (
        <div
          style={{
            border: `1px solid ${D1.hair}`, borderRadius: 10, padding: '12px 14px',
            background: D1.surface, marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 10, color: D1.muted, textTransform: 'uppercase',
              letterSpacing: 0.6, fontWeight: 500, marginBottom: 8,
            }}
          >
            {intl.formatMessage({ id: 'summary' })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span>{selectedRoom.name}</span>
            <span>{brl(selectedRoom.pricePerNight)}</span>
          </div>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${D1.hair}`,
            }}
          >
            <span
              style={{
                fontSize: 11, color: D1.muted, textTransform: 'uppercase',
                letterSpacing: 0.6, fontWeight: 500,
              }}
            >
              {intl.formatMessage({ id: 'totalLabel' })}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{brl(selectedRoom.pricePerNight)}</span>
          </div>
        </div>
      )}

      <Suspense
        fallback={
          <div style={{ color: D1.muted, fontSize: 14 }}>
            {intl.formatMessage({ id: 'creatingPayment' })}
          </div>
        }
      >
        {clientSecret && publishableKey && (
          <StripeFormLazy clientSecret={clientSecret} publishableKey={publishableKey} />
        )}
      </Suspense>
    </div>
  )
}
