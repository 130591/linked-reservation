import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createApiClient, type ApiClient } from '../api/client'

function decodeJwtExp(token: string): Date | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1])) as { exp?: unknown }
    return typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : null
  } catch {
    return null
  }
}

export interface SessionState {
  token: string | null
  expiresAt: Date | null
  client: ApiClient
}

export const SessionContext = createContext<SessionState>({
  token: null,
  expiresAt: null,
  client: createApiClient(null),
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const expiresAt = token ? decodeJwtExp(token) : null
  const client = useMemo(() => createApiClient(token), [token])

  return (
    <SessionContext.Provider value={{ token, expiresAt, client }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionState {
  return useContext(SessionContext)
}
