import type { ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import ptBR from './pt-BR.json'
import en from './en.json'

type Messages = typeof ptBR

const MESSAGES: Record<string, Messages> = {
  'pt-BR': ptBR,
  'pt': ptBR,
  en,
}

function resolveLocale(lang: string): string {
  if (lang in MESSAGES) return lang
  const short = lang.split('-')[0]
  if (short in MESSAGES) return short
  return 'pt-BR'
}

export function AppIntlProvider({ children }: { children: ReactNode }) {
  const locale = resolveLocale(navigator.language)
  const messages = MESSAGES[locale] ?? ptBR

  return (
    <IntlProvider locale={locale} messages={messages} defaultLocale="pt-BR">
      {children}
    </IntlProvider>
  )
}

export { resolveLocale }
