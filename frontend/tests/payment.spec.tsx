import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { SessionProvider, useSession } from '../src/context/SessionContext'
import { BookingContext } from '../src/context/BookingContext'
import { usePaymentStatus } from '../src/hooks/usePaymentStatus'
import { useCountdown } from '../src/hooks/useCountdown'
import { PaymentStep } from '../src/steps/PaymentStep'
import ptBR from '../src/i18n/pt-BR.json'
import type { Room, ConfirmationView } from '../src/types'

// ── Stripe mocks ──────────────────────────────────────────────────────────────

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() =>
    Promise.resolve({
      confirmPayment: vi.fn().mockResolvedValue({ error: null }),
    }),
  ),
}))

vi.mock('@stripe/react-stripe-js', async () => {
  const React = await import('react')
  return {
    Elements: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'stripe-elements' }, children),
    PaymentElement: () =>
      React.createElement('div', { 'data-testid': 'stripe-payment-element' }),
    useStripe: () => ({ confirmPayment: vi.fn().mockResolvedValue({ error: null }) }),
    useElements: () => ({}),
  }
})

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
  vi.useRealTimers()
})
afterAll(() => server.close())

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJwt(expSeconds: number): string {
  const h = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = btoa(JSON.stringify({ sub: 's', exp: expSeconds }))
  return `${h}.${p}.sig`
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

const MOCK_ROOM: Room = {
  id: 'r1', name: 'Suíte Master', short: 'Vista', pricePerNight: 350,
  description: 'desc', amenities: [], capacity: 2, hueA: 200, hueB: 220,
}

const MOCK_CONFIRMATION: ConfirmationView = {
  bookingReference: 'LR-2605-ABCD1',
  property: { name: 'Test Hotel', whatsappNumber: '+55119999' },
  room: { id: 'r1', name: 'Suíte Master' },
  period: { checkIn: '2026-06-01', checkOut: '2026-06-03' },
  guests: 2,
  totalPaid: { amount: 35000, currency: 'BRL' },
  guest: { name: 'Maria', email: 'maria@test.com', phone: '+5511987' },
}

const BOOKING_CONTEXT_VALUE = {
  selectedRoom: MOCK_ROOM,
  reservationId: 'res-123',
  guestDetails: { name: 'Maria', email: 'maria@test.com', phone: '+5511987654321' },
  setSelectedRoom: vi.fn(),
  setReservationId: vi.fn(),
  setGuestDetails: vi.fn(),
}

function renderPaymentStep(token: string) {
  const qc = makeQc()
  return render(
    <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <BookingContext.Provider value={BOOKING_CONTEXT_VALUE}>
              <Routes>
                <Route path="/booking" element={<PaymentStep onBack={vi.fn()} />} />
                <Route path="/booking/expired" element={<div data-testid="expired-page" />} />
                <Route path="/booking/confirmation" element={<div data-testid="confirmation-page" />} />
              </Routes>
            </BookingContext.Provider>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

// ── usePaymentStatus wrapper ───────────────────────────────────────────────────

function HookWrapper({ intentId, onFailed = vi.fn() }: { intentId: string | null; onFailed?: () => void }) {
  usePaymentStatus(intentId, onFailed)
  return <div data-testid="hook-mounted" />
}

function renderHook(intentId: string | null, onFailed = vi.fn()) {
  const qc = makeQc()
  const expSeconds = Math.floor(Date.now() / 1000) + 900
  const token = makeJwt(expSeconds)
  return render(
    <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <Routes>
              <Route path="/booking" element={<HookWrapper intentId={intentId} onFailed={onFailed} />} />
              <Route path="/booking/confirmation" element={<div data-testid="confirmation-page" />} />
              <Route path="/booking/expired" element={<div data-testid="expired-page" />} />
            </Routes>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

// CountdownShell wraps PaymentStep with the countdown hook (mimics WizardShell)
function CountdownShell({ expSeconds: _expSeconds }: { expSeconds: number }) {
  const { expiresAt } = useSession()
  useCountdown(expiresAt)
  return <PaymentStep onBack={vi.fn()} />
}

function renderWithCountdown(token: string) {
  const qc = makeQc()
  return render(
    <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <BookingContext.Provider value={BOOKING_CONTEXT_VALUE}>
              <Routes>
                <Route
                  path="/booking"
                  element={
                    <CountdownShell expSeconds={Math.floor(Date.now() / 1000) + 900} />
                  }
                />
                <Route path="/booking/expired" element={<div data-testid="expired-page" />} />
                <Route path="/booking/confirmation" element={<div data-testid="confirmation-page" />} />
              </Routes>
            </BookingContext.Provider>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

// ── Unit tests: usePaymentStatus ──────────────────────────────────────────────

describe('usePaymentStatus', () => {
  it('calls the status endpoint every 3 seconds while mounted', async () => {
    vi.useFakeTimers()
    let callCount = 0
    server.use(
      http.get('/booking/payment-status', () => {
        callCount++
        return HttpResponse.json({ status: 'pending', succeededAt: null })
      }),
    )

    renderHook('pi-1')
    expect(callCount).toBe(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(callCount).toBe(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(callCount).toBe(2)

    vi.useRealTimers()
  })

  it('stops polling on succeeded status', async () => {
    vi.useFakeTimers()
    let callCount = 0
    server.use(
      http.get('/booking/payment-status', () => {
        callCount++
        return HttpResponse.json({ status: 'succeeded', succeededAt: new Date().toISOString() })
      }),
      http.post('/booking/confirmation', () =>
        HttpResponse.json({ viewToken: 'vt-1', confirmation: MOCK_CONFIRMATION }),
      ),
    )

    renderHook('pi-1')
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    const countAfterFirst = callCount
    expect(countAfterFirst).toBe(1)

    // Advance two more intervals — no additional calls expected
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(callCount).toBe(countAfterFirst)

    vi.useRealTimers()
  })

  it('stops polling on failed status and calls onFailed', async () => {
    vi.useFakeTimers()
    let callCount = 0
    const onFailed = vi.fn()
    server.use(
      http.get('/booking/payment-status', () => {
        callCount++
        return HttpResponse.json({ status: 'failed', succeededAt: null })
      }),
    )

    renderHook('pi-1', onFailed)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(callCount).toBe(1)
    expect(onFailed).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(callCount).toBe(1)

    vi.useRealTimers()
  })

  it('stops polling on cancelled status and calls onFailed', async () => {
    vi.useFakeTimers()
    let callCount = 0
    const onFailed = vi.fn()
    server.use(
      http.get('/booking/payment-status', () => {
        callCount++
        return HttpResponse.json({ status: 'cancelled', succeededAt: null })
      }),
    )

    renderHook('pi-1', onFailed)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(callCount).toBe(1)
    expect(onFailed).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(callCount).toBe(1)

    vi.useRealTimers()
  })

  it('stops polling on unmount', async () => {
    vi.useFakeTimers()
    let callCount = 0
    server.use(
      http.get('/booking/payment-status', () => {
        callCount++
        return HttpResponse.json({ status: 'pending', succeededAt: null })
      }),
    )

    const { unmount } = renderHook('pi-1')

    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(callCount).toBe(1)

    unmount()

    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(callCount).toBe(1) // No new calls after unmount

    vi.useRealTimers()
  })

  it('calls POST /booking/confirmation exactly once on succeeded, then navigates to confirmation', async () => {
    let confirmationCallCount = 0
    server.use(
      http.get('/booking/payment-status', () =>
        HttpResponse.json({ status: 'succeeded', succeededAt: new Date().toISOString() }),
      ),
      http.post('/booking/confirmation', () => {
        confirmationCallCount++
        return HttpResponse.json({ viewToken: 'vt-123', confirmation: MOCK_CONFIRMATION })
      }),
    )

    renderHook('pi-1')

    // navigate() fires after two awaits in poll(); real timers let waitFor retry
    await waitFor(
      () => expect(screen.getByTestId('confirmation-page')).toBeInTheDocument(),
      { timeout: 6000 },
    )
    // Confirmation called exactly once
    expect(confirmationCallCount).toBe(1)
  }, 10000)
})

// ── Integration: Payment step (real timers) ───────────────────────────────────

describe('Integration: Payment step', () => {
  it('Scenario: When step mounts, POST /booking/payment-intent is called once and Stripe Payment Element is rendered', async () => {
    let intentCallCount = 0
    server.use(
      http.post('/booking/payment-intent', () => {
        intentCallCount++
        return HttpResponse.json({ intentId: 'pi-abc', clientSecret: 'cs-secret', publishableKey: 'pk-test' })
      }),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderPaymentStep(makeJwt(exp))

    await waitFor(
      () => expect(screen.getByTestId('stripe-payment-element')).toBeInTheDocument(),
      { timeout: 8000 },
    )
    expect(intentCallCount).toBe(1)
  }, 10000)

  it('Scenario: When polling receives succeeded after the 3rd poll, confirmation is called, URL token is replaced, route changes to /booking/confirmation', async () => {
    let pollCount = 0
    let confirmCallCount = 0

    server.use(
      http.post('/booking/payment-intent', () =>
        HttpResponse.json({ intentId: 'pi-xyz', clientSecret: 'cs-x', publishableKey: 'pk-x' }),
      ),
      http.get('/booking/payment-status', () => {
        pollCount++
        const status = pollCount >= 3 ? 'succeeded' : 'pending'
        return HttpResponse.json({ status, succeededAt: status === 'succeeded' ? new Date().toISOString() : null })
      }),
      http.post('/booking/confirmation', () => {
        confirmCallCount++
        return HttpResponse.json({ viewToken: 'view-tok-456', confirmation: MOCK_CONFIRMATION })
      }),
    )

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

    const exp = Math.floor(Date.now() / 1000) + 900
    renderPaymentStep(makeJwt(exp))

    // Real timers: 3 polls × 3s each before succeeded; navigate() fires after two awaits
    // inside poll() — waitFor retries until React flushes the route update
    await waitFor(
      () => expect(screen.getByTestId('confirmation-page')).toBeInTheDocument(),
      { timeout: 12000 },
    )
    expect(confirmCallCount).toBe(1)
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', expect.stringContaining('token=view-tok-456'))
  }, 15000)

  it('Scenario: When polling receives failed, failure UI is shown and Retry creates a new payment intent', async () => {
    vi.useFakeTimers()
    let intentCallCount = 0

    server.use(
      http.post('/booking/payment-intent', () => {
        intentCallCount++
        return HttpResponse.json({ intentId: `pi-${intentCallCount}`, clientSecret: 'cs-y', publishableKey: 'pk-y' })
      }),
      http.get('/booking/payment-status', () =>
        HttpResponse.json({ status: 'failed', succeededAt: null }),
      ),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderPaymentStep(makeJwt(exp))

    // Flush intent creation + Stripe form
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    // Trigger the failed poll
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    // Failure UI shown
    expect(screen.getByText(ptBR.paymentFailed)).toBeInTheDocument()
    expect(intentCallCount).toBe(1)

    // Tap Retry — a second payment intent is created
    fireEvent.click(screen.getByText(ptBR.retryPayment))

    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    expect(intentCallCount).toBe(2)

    vi.useRealTimers()
  }, 10000)

  it('Scenario: When countdown reaches 0 during polling, route changes to /booking/expired', async () => {
    vi.useFakeTimers()

    server.use(
      http.post('/booking/payment-intent', () =>
        HttpResponse.json({ intentId: 'pi-exp', clientSecret: 'cs-exp', publishableKey: 'pk-exp' }),
      ),
      http.get('/booking/payment-status', () =>
        HttpResponse.json({ status: 'pending', succeededAt: null }),
      ),
    )

    const exp = Math.floor(Date.now() / 1000) + 5
    renderWithCountdown(makeJwt(exp))

    // Flush initial render
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })

    // Advance past the session expiry (5s + buffer)
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })

    expect(screen.getByTestId('expired-page')).toBeInTheDocument()

    vi.useRealTimers()
  }, 10000)

  it('Scenario: PaymentStep.tsx uses dynamic import for Stripe — no static Stripe imports', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/steps/PaymentStep.tsx'), 'utf-8')
    // Must not have static @stripe imports at the top level
    expect(content).not.toMatch(/^import .+ from ['"]@stripe\//m)
    // Must use React.lazy for the Stripe form
    expect(content).toMatch(/lazy\(/)
  })
})
