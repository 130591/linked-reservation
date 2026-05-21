import { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useIntl } from 'react-intl'
import { useTheme } from '../theme'
import { PrimaryBtn } from '../components/PrimaryBtn'
import { Icon } from '../components/Icon'

function StripeFormInner() {
  const intl = useIntl()
  const t = useTheme()
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message ?? intl.formatMessage({ id: 'paymentFailed' }))
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PaymentElement />
      {error && (
        <div role="alert" style={{ fontSize: 12, color: t.color.error, marginTop: t.space.sm }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: t.space.lg }}>
        <PrimaryBtn onClick={handlePay} disabled={submitting} full>
          {submitting
            ? intl.formatMessage({ id: 'processing' })
            : intl.formatMessage({ id: 'payNow' })}{' '}
          <Icon.lock size={13} />
        </PrimaryBtn>
      </div>
      <div
        style={{
          display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          marginTop: 14, fontSize: t.fontSize.sm, color: t.color.muted,
        }}
      >
        <Icon.lock size={12} /> {intl.formatMessage({ id: 'securePayment' })}
      </div>
    </div>
  )
}

export interface StripeFormProps {
  clientSecret: string
  publishableKey: string
}

export default function StripeForm({ clientSecret, publishableKey }: StripeFormProps) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey])

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeFormInner />
    </Elements>
  )
}
