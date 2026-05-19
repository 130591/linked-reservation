import { useState } from 'react'
import { useIntl } from 'react-intl'
import { D1 } from '../components/theme'
import { WhatsAppHeader } from '../components/WhatsAppHeader'
import { StepDots } from '../components/StepDots'
import { useSession } from '../context/SessionContext'
import { useCountdown } from '../hooks/useCountdown'
import { BookingProvider } from '../context/BookingContext'
import { RoomSelectionStep } from '../steps/RoomSelectionStep'
import { RoomDetailsStep } from '../steps/RoomDetailsStep'
import { GuestDetailsStep } from '../steps/GuestDetailsStep'
import { PaymentStep } from '../steps/PaymentStep'

const TOTAL_STEPS = 5

function WizardShell({
  step,
  children,
}: {
  step: number
  children: React.ReactNode
}) {
  const intl = useIntl()
  const { expiresAt } = useSession()
  const { remainingSeconds } = useCountdown(expiresAt)

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const seconds = String(remainingSeconds % 60).padStart(2, '0')

  return (
    <div
      style={{
        height: '100%',
        background: D1.bg,
        color: D1.ink,
        fontFamily: D1.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <WhatsAppHeader host="Linked Reservation" />
      <div
        style={{
          padding: '12px 20px 10px',
          borderBottom: `1px solid ${D1.hairSoft}`,
          background: D1.bg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <StepDots step={step} total={TOTAL_STEPS} />
        {expiresAt && (
          <div
            data-testid="countdown"
            style={{ fontSize: 11, color: D1.muted, fontVariantNumeric: 'tabular-nums' }}
          >
            {intl.formatMessage({ id: 'minutesRemaining' }, { minutes, seconds })}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
        {children}
      </div>
    </div>
  )
}

export function BookingRoute() {
  const [step, setStep] = useState(0)

  return (
    <BookingProvider>
      <WizardShell step={step}>
        {step === 0 && (
          <RoomSelectionStep onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <RoomDetailsStep onNext={() => setStep(2)} onBack={() => setStep(0)} />
        )}
        {step === 2 && (
          <GuestDetailsStep onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <PaymentStep onBack={() => setStep(2)} />
        )}
      </WizardShell>
    </BookingProvider>
  )
}
