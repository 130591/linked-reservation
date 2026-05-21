import { Suspense, lazy, useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useIntl } from 'react-intl'
import { useTheme, recipes } from '../theme'
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
  const t = useTheme()
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
        <button onClick={onBack} style={recipes.backButton(t)}>
          <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
        </button>
        <div style={recipes.stepTitle(t)}>
          {intl.formatMessage({ id: 'paymentFailed' })}
        </div>
        <div style={{ ...recipes.subtitle(t), marginBottom: t.space.xxl }}>
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
        <div role="alert" style={{ color: t.color.error, fontSize: t.fontSize.md }}>
          {intl.formatMessage({ id: 'errorCreatingPayment' })}
        </div>
        <button
          onClick={() => createMutation.mutate()}
          style={{ marginTop: t.space.md, background: 'transparent', border: `1px solid ${t.color.hair}`, borderRadius: t.radius.md, padding: '8px 14px', cursor: 'pointer', fontSize: t.fontSize.base }}
        >
          {intl.formatMessage({ id: 'retryPayment' })}
        </button>
      </div>
    )
  }

  const isLoading = createMutation.isPending || (!clientSecret && !createMutation.isError)

  if (isLoading) {
    return (
      <div style={{ padding: t.space.xl, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: t.color.muted, fontSize: t.fontSize.md }}>{intl.formatMessage({ id: 'creatingPayment' })}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '18px 20px 100px' }}>
      <button onClick={onBack} style={recipes.backButton(t)}>
        <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
      </button>

      <div style={recipes.stepTitle(t)}>
        {intl.formatMessage({ id: 'paymentTitle' })}
      </div>
      <div style={{ ...recipes.subtitle(t), marginBottom: t.space.xl - 2 }}>
        {intl.formatMessage({ id: 'paymentSub' })}
      </div>

      {selectedRoom && (
        <div style={{ ...recipes.cardBox(t), marginBottom: t.space.xl - 2 }}>
          <div style={{ ...recipes.caption(t), marginBottom: t.space.sm }}>
            {intl.formatMessage({ id: 'summary' })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: t.fontSize.base, marginBottom: 3 }}>
            <span>{selectedRoom.name}</span>
            <span>{brl(selectedRoom.pricePerNight)}</span>
          </div>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginTop: t.space.lg - 6, paddingTop: t.space.lg - 6, borderTop: `1px solid ${t.color.hair}`,
            }}
          >
            <span style={{ ...recipes.caption(t), fontSize: t.fontSize.sm }}>
              {intl.formatMessage({ id: 'totalLabel' })}
            </span>
            <span style={{ fontSize: 20, fontWeight: t.fontWeight.bold }}>{brl(selectedRoom.pricePerNight)}</span>
          </div>
        </div>
      )}

      <Suspense
        fallback={
          <div style={{ color: t.color.muted, fontSize: t.fontSize.md }}>
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
