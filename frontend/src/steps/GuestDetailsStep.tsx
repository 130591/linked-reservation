import { useState } from 'react'
import { useIntl } from 'react-intl'
import { useTheme, recipes } from '../theme'
import { PrimaryBtn } from '../components/PrimaryBtn'
import { StickyFooter } from '../components/StickyFooter'
import { Icon } from '../components/Icon'
import { useBooking } from '../context/BookingContext'
import { validateName, validateEmail, validatePhone } from '../utils/validators'
import type { GuestDetails } from '../context/BookingContext'

interface Props {
  onNext: () => void
  onBack: () => void
}

interface FormState {
  name: string
  email: string
  phone: string
}

function FieldError({ id }: { id: string }) {
  const intl = useIntl()
  const t = useTheme()
  return (
    <div role="alert" style={{ fontSize: t.fontSize.sm, color: t.color.error, marginTop: t.space.xs }}>
      {intl.formatMessage({ id })}
    </div>
  )
}

export function GuestDetailsStep({ onNext, onBack }: Props) {
  const intl = useIntl()
  const t = useTheme()
  const { setGuestDetails } = useBooking()

  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({})

  const validateField = (field: keyof FormState, value: string): string | null => {
    if (field === 'name') return validateName(value)
    if (field === 'email') return validateEmail(value)
    if (field === 'phone') return validatePhone(value)
    return null
  }

  const handleBlur = (field: keyof FormState) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const err = validateField(field, form[field])
    setErrors(prev => ({ ...prev, [field]: err ?? undefined }))
  }

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (touched[field]) {
      const err = validateField(field, value)
      setErrors(prev => ({ ...prev, [field]: err ?? undefined }))
    }
  }

  const handleSubmit = () => {
    const allErrors: Partial<Record<keyof FormState, string>> = {}
    const fields: (keyof FormState)[] = ['name', 'email', 'phone']
    fields.forEach(f => {
      const err = validateField(f, form[f])
      if (err) allErrors[f] = err
    })
    setErrors(allErrors)
    setTouched({ name: true, email: true, phone: true })

    if (Object.keys(allErrors).length === 0) {
      const details: GuestDetails = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() }
      setGuestDetails(details)
      onNext()
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: t.fontSize.sm, color: t.color.muted, fontWeight: t.fontWeight.medium, marginBottom: 5,
  }

  const baseInput = recipes.inputBase(t)
  const errorInput = recipes.inputError(t)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px 20px' }}>
        <button onClick={onBack} style={recipes.backButton(t)}>
          <Icon.back size={14} /> {intl.formatMessage({ id: 'backBtn' })}
        </button>

        <div style={recipes.stepTitle(t)}>
          {intl.formatMessage({ id: 'guestDataTitle' })}
        </div>
        <div style={{ ...recipes.subtitle(t), marginBottom: t.space.xl }}>
          {intl.formatMessage({ id: 'guestDataSub' })}
        </div>

        {/* Name */}
        <div style={{ marginBottom: t.space.md }}>
          <div style={labelStyle}>{intl.formatMessage({ id: 'fullName' })}</div>
          <input
            value={form.name}
            placeholder="Maria da Silva"
            onChange={e => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            aria-label={intl.formatMessage({ id: 'fullName' })}
            aria-invalid={!!errors.name}
            style={errors.name ? errorInput : baseInput}
          />
          {errors.name && <FieldError id={errors.name} />}
        </div>

        {/* Email */}
        <div style={{ marginBottom: t.space.md }}>
          <div style={labelStyle}>{intl.formatMessage({ id: 'email' })}</div>
          <input
            type="email"
            value={form.email}
            placeholder="maria@exemplo.com"
            onChange={e => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            aria-label={intl.formatMessage({ id: 'email' })}
            aria-invalid={!!errors.email}
            style={errors.email ? errorInput : baseInput}
          />
          {errors.email && <FieldError id={errors.email} />}
        </div>

        {/* Phone */}
        <div style={{ marginBottom: t.space.md }}>
          <div style={labelStyle}>{intl.formatMessage({ id: 'phone' })}</div>
          <input
            type="tel"
            value={form.phone}
            placeholder="+55 48 9 9999-9999"
            onChange={e => handleChange('phone', e.target.value)}
            onBlur={() => handleBlur('phone')}
            aria-label={intl.formatMessage({ id: 'phone' })}
            aria-invalid={!!errors.phone}
            style={errors.phone ? errorInput : baseInput}
          />
          {intl.formatMessage({ id: 'phoneHint' }) && (
            <div style={{ fontSize: t.fontSize.sm, color: t.color.muted, marginTop: t.space.xs }}>
              {intl.formatMessage({ id: 'phoneHint' })}
            </div>
          )}
          {errors.phone && <FieldError id={errors.phone} />}
        </div>
      </div>

      <StickyFooter>
        <PrimaryBtn onClick={handleSubmit} full>
          {intl.formatMessage({ id: 'continueBtn' })} <Icon.arrow size={13} />
        </PrimaryBtn>
      </StickyFooter>
    </div>
  )
}
