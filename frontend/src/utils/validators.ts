const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{10,14}$/

export function validateName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2) return 'nameTooShort'
  if (trimmed.length > 200) return 'nameTooLong'
  return null
}

export function validateEmail(email: string): string | null {
  if (!email || !EMAIL_RE.test(email)) return 'emailInvalid'
  return null
}

export function validatePhone(phone: string): string | null {
  if (!phone || !PHONE_RE.test(phone)) return 'phoneInvalid'
  return null
}
