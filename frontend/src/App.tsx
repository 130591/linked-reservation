import { useMemo } from 'react'
import { Routes, Route, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { SessionProvider } from './context/SessionContext'
import { ThemeProvider } from './theme'
import { AppIntlProvider } from './i18n'
import { BookingRoute } from './routes/BookingRoute'
import { ConfirmationRoute } from './routes/ConfirmationRoute'
import { ExpiredRoute } from './routes/ExpiredRoute'
import { SessionExpiredError } from './api/client'

function RootRedirect() {
  const [searchParams] = useSearchParams()
  const qs = searchParams.toString()
  return <Navigate to={qs ? `/booking?${qs}` : '/booking'} replace />
}

function AppRoutes() {
  const navigate = useNavigate()

  const queryClient = useMemo(() => {
    const handleError = (error: unknown) => {
      if (error instanceof SessionExpiredError) {
        navigate('/booking/expired', { replace: true })
      }
    }

    return new QueryClient({
      queryCache: new QueryCache({ onError: handleError }),
      mutationCache: new MutationCache({ onError: handleError }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: (failureCount, error) => {
            if (error instanceof SessionExpiredError) return false
            return failureCount < 1
          },
        },
        mutations: {
          retry: false,
        },
      },
    })
  }, [navigate])

  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/booking" element={<BookingRoute />} />
        <Route path="/booking/confirmation" element={<ConfirmationRoute />} />
        <Route path="/booking/expired" element={<ExpiredRoute />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </QueryClientProvider>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AppIntlProvider>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </AppIntlProvider>
    </ThemeProvider>
  )
}
