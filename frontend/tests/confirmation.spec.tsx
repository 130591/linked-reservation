import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SessionProvider } from '../src/context/SessionContext'
import { BookingRoute } from '../src/routes/BookingRoute'
import { ConfirmationRoute } from '../src/routes/ConfirmationRoute'
import { ExpiredRoute } from '../src/routes/ExpiredRoute'
import { buildWhatsAppUrl } from '../src/utils/whatsapp'
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

// ── Shared fixtures ───────────────────────────────────────────────────────────

const MOCK_CONFIRMATION: ConfirmationView = {
  bookingReference: 'LR-2605-ABCD1',
  property: { name: 'Test Hotel', whatsappNumber: '+5511999990000' },
  room: { id: 'r1', name: 'Suíte Master' },
  period: { checkIn: '2026-06-01', checkOut: '2026-06-03' },
  guests: 2,
  totalPaid: { amount: 35000, currency: 'BRL' },
  guest: { name: 'Maria', email: 'maria@test.com', phone: '+5511987' },
}

const MOCK_ROOM: Room = {
  id: 'r1',
  name: 'Suíte Master',
  short: 'Vista para o mar',
  pricePerNight: 350,
  description: 'desc',
  amenities: [],
  capacity: 2,
  hueA: 200,
  hueB: 220,
}

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

// ── Render helpers ────────────────────────────────────────────────────────────

function renderConfirmationRoute(token: string) {
  const qc = makeQc()
  return render(
    <MemoryRouter initialEntries={[`/booking/confirmation?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <Routes>
              <Route path="/booking/confirmation" element={<ConfirmationRoute />} />
            </Routes>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

function renderExpiredRoute() {
  return render(
    <MemoryRouter initialEntries={['/booking/expired']}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <Routes>
          <Route path="/booking/expired" element={<ExpiredRoute />} />
        </Routes>
      </IntlProvider>
    </MemoryRouter>,
  )
}

function renderApp(token: string) {
  const qc = makeQc()
  return render(
    <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <Routes>
              <Route path="/booking" element={<BookingRoute />} />
              <Route path="/booking/confirmation" element={<ConfirmationRoute />} />
              <Route path="/booking/expired" element={<ExpiredRoute />} />
              <Route path="*" element={<Navigate to="/booking" replace />} />
            </Routes>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

// ── Unit tests: buildWhatsAppUrl ──────────────────────────────────────────────

describe('buildWhatsAppUrl', () => {
  it('builds https://wa.me/+5511987654321?text=... from phone and greeting', () => {
    const url = buildWhatsAppUrl('+5511987654321', 'Olá! Reserva LR-2605-ABCD1.')
    expect(url).toBe(
      `https://wa.me/+5511987654321?text=${encodeURIComponent('Olá! Reserva LR-2605-ABCD1.')}`,
    )
  })

  it('strips spaces, dashes, and parens from phone number', () => {
    const url = buildWhatsAppUrl('+55 (11) 9999-0000', 'Olá')
    expect(url).toBe(`https://wa.me/+551199990000?text=${encodeURIComponent('Olá')}`)
  })

  it('encodes special characters in the greeting text', () => {
    const url = buildWhatsAppUrl('+5511999990000', 'Olá! Ref: LR-2605-ABCD1.')
    expect(url).toContain('https://wa.me/+5511999990000?text=')
    expect(url).toContain(encodeURIComponent('Olá! Ref: LR-2605-ABCD1.'))
  })
})

// ── Integration: ConfirmationRoute ────────────────────────────────────────────

describe('Integration: ConfirmationRoute', () => {
  it('Scenario: Given a valid view token, renders booking reference, room, dates, and total', async () => {
    server.use(
      http.get('/booking/confirmation', () => HttpResponse.json(MOCK_CONFIRMATION)),
    )

    const token = makeJwt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600)
    renderConfirmationRoute(token)

    await waitFor(() =>
      expect(screen.getByTestId('booking-reference')).toBeInTheDocument(),
    )

    expect(screen.getByTestId('booking-reference').textContent).toBe('LR-2605-ABCD1')
    expect(screen.getByText('Suíte Master')).toBeInTheDocument()
    // Check-in and check-out dates rendered
    expect(screen.getByText(/01\/06\/2026.*03\/06\/2026/)).toBeInTheDocument()
    // Total is 35000 cents = R$350
    expect(screen.getByText(/R\$\s*350/)).toBeInTheDocument()
    // Property name appears in header and summary — confirm at least one instance exists
    expect(screen.getAllByText('Test Hotel').length).toBeGreaterThanOrEqual(1)
  })

  it('Scenario: Given the confirmation endpoint returns 410, renders token error screen', async () => {
    server.use(
      http.get('/booking/confirmation', () =>
        HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 410 }),
      ),
    )

    const token = makeJwt(Math.floor(Date.now() / 1000) + 900)
    renderConfirmationRoute(token)

    await waitFor(() =>
      expect(screen.getByTestId('token-error-screen')).toBeInTheDocument(),
    )
    expect(screen.getByText(ptBR.tokenErrorTitle)).toBeInTheDocument()
  })

  it('Scenario: Given the confirmation endpoint returns 401, renders token error screen', async () => {
    server.use(
      http.get('/booking/confirmation', () =>
        HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    )

    const token = makeJwt(Math.floor(Date.now() / 1000) + 900)
    renderConfirmationRoute(token)

    await waitFor(() =>
      expect(screen.getByTestId('token-error-screen')).toBeInTheDocument(),
    )
    expect(screen.getByText(ptBR.tokenErrorSub)).toBeInTheDocument()
  })

  it('Scenario: Given the user taps the WhatsApp button, window.open is called with wa.me URL', async () => {
    server.use(
      http.get('/booking/confirmation', () => HttpResponse.json(MOCK_CONFIRMATION)),
    )

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const token = makeJwt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600)
    renderConfirmationRoute(token)

    await waitFor(() => expect(screen.getByTestId('whatsapp-btn')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('whatsapp-btn'))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('wa.me/+5511999990000'),
      '_blank',
    )
    openSpy.mockRestore()
  })
})

// ── Integration: ExpiredRoute ─────────────────────────────────────────────────

describe('Integration: ExpiredRoute', () => {
  it('Scenario: /booking/expired renders without making any backend call', async () => {
    let backendCalled = false
    server.use(
      http.get('*', () => {
        backendCalled = true
        return new HttpResponse(null, { status: 200 })
      }),
    )

    renderExpiredRoute()

    expect(screen.getByText(ptBR.sessionExpiredTitle)).toBeInTheDocument()
    expect(screen.getByText(ptBR.sessionExpiredSub)).toBeInTheDocument()
    expect(backendCalled).toBe(false)
  })
})

// ── E2E: Happy path ───────────────────────────────────────────────────────────

describe('E2E: Full wizard happy path', () => {
  it(
    'Scenario: room selection → guest details → payment → confirmation with LR reference and view token in URL',
    async () => {
      server.use(
        http.get('/booking/rooms', () => HttpResponse.json([MOCK_ROOM])),
        http.post('/booking/select', () => HttpResponse.json({ reservationId: 'res-e2e' })),
        http.post('/booking/payment-intent', () =>
          HttpResponse.json({
            intentId: 'pi-e2e',
            clientSecret: 'cs-e2e',
            publishableKey: 'pk-e2e',
          }),
        ),
        http.get('/booking/payment-status', () =>
          HttpResponse.json({ status: 'succeeded', succeededAt: new Date().toISOString() }),
        ),
        http.post('/booking/confirmation', () =>
          HttpResponse.json({ viewToken: 'view-e2e-tok', confirmation: MOCK_CONFIRMATION }),
        ),
        http.get('/booking/confirmation', () => HttpResponse.json(MOCK_CONFIRMATION)),
      )

      const replaceStateSpy = vi.spyOn(window.history, 'replaceState')

      const exp = Math.floor(Date.now() / 1000) + 900
      renderApp(makeJwt(exp))

      // Step 0: Room selection — wait for rooms to load and click
      await waitFor(
        () => expect(screen.getByText('Suíte Master')).toBeInTheDocument(),
        { timeout: 5000 },
      )
      fireEvent.click(screen.getByRole('button', { name: /suíte master/i }))

      // Step 1: Guest details — fill in form and submit
      await waitFor(
        () => expect(screen.getByText(ptBR.guestDataTitle)).toBeInTheDocument(),
        { timeout: 3000 },
      )
      fireEvent.change(screen.getByLabelText(ptBR.fullName), {
        target: { value: 'Maria Silva' },
      })
      fireEvent.change(screen.getByLabelText(ptBR.email), {
        target: { value: 'maria@test.com' },
      })
      fireEvent.change(screen.getByLabelText(ptBR.phone), {
        target: { value: '+5511987654321' },
      })
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

      // Step 2: Payment mounts → polling → confirmation route
      // usePaymentStatus polls every 3s; mock returns succeeded immediately on first poll.
      // ConfirmationRoute then calls GET /booking/confirmation and renders the reference.
      await waitFor(
        () => expect(screen.getByTestId('booking-reference')).toBeInTheDocument(),
        { timeout: 15000 },
      )

      expect(screen.getByTestId('booking-reference').textContent).toBe('LR-2605-ABCD1')
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('token=view-e2e-tok'),
      )
    },
    20000,
  )
})
