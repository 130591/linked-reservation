import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SessionProvider } from '../src/context/SessionContext'
import { BookingContext } from '../src/context/BookingContext'
import { validateName, validateEmail, validatePhone } from '../src/utils/validators'
import { GuestDetailsStep } from '../src/steps/GuestDetailsStep'
import { BookingRoute } from '../src/routes/BookingRoute'
import ptBR from '../src/i18n/pt-BR.json'
import type { Room } from '../src/types'

// ── MSW server ────────────────────────────────────────────────────────────────

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
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

function renderWizard(token: string) {
  const qc = makeQc()
  render(
    <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <SessionProvider>
          <QueryClientProvider client={qc}>
            <Routes>
              <Route path="/booking" element={<BookingRoute />} />
              <Route path="/booking/expired" element={<div data-testid="expired-page">expirado</div>} />
            </Routes>
          </QueryClientProvider>
        </SessionProvider>
      </IntlProvider>
    </MemoryRouter>,
  )
}

const MOCK_ROOMS: Room[] = [
  { id: 'r1', name: 'Suíte Master', short: 'Vista para o mar', pricePerNight: 350, description: 'desc', amenities: [], capacity: 2, hueA: 200, hueB: 220 },
  { id: 'r2', name: 'Quarto Deluxe', short: 'Varanda privativa', pricePerNight: 280, description: 'desc', amenities: [], capacity: 2, hueA: 100, hueB: 120 },
  { id: 'r3', name: 'Quarto Standard', short: 'Conforto e praticidade', pricePerNight: 180, description: 'desc', amenities: [], capacity: 2, hueA: 50, hueB: 70 },
]

const MOCK_ROOM = MOCK_ROOMS[0]

// ── Unit tests: validators ────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts a valid email address', () => {
    expect(validateEmail('guest@example.com')).toBeNull()
  })

  it('rejects an invalid email address', () => {
    expect(validateEmail('not-an-email')).toBe('emailInvalid')
  })
})

describe('validatePhone', () => {
  it('accepts +5511987654321 (with country code prefix)', () => {
    expect(validatePhone('+5511987654321')).toBeNull()
  })

  it('accepts 5511987654321 (without + prefix)', () => {
    expect(validatePhone('5511987654321')).toBeNull()
  })

  it('rejects a number that is too short', () => {
    expect(validatePhone('1234')).toBe('phoneInvalid')
  })
})

describe('validateName', () => {
  it('rejects an empty string', () => {
    expect(validateName('')).toBe('nameTooShort')
  })

  it('rejects strings longer than 200 characters', () => {
    expect(validateName('a'.repeat(201))).toBe('nameTooLong')
  })

  it('accepts a valid name', () => {
    expect(validateName('Maria da Silva')).toBeNull()
  })
})

// ── Integration: Room selection step ─────────────────────────────────────────

describe('Integration: Room selection step', () => {
  it('Given GET /booking/rooms returns 3 rooms, renders 3 room cards', async () => {
    server.use(
      http.get('/booking/rooms', () => HttpResponse.json(MOCK_ROOMS)),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderWizard(makeJwt(exp))

    await waitFor(() => {
      expect(screen.getByText('Suíte Master')).toBeInTheDocument()
    })
    expect(screen.getByText('Quarto Deluxe')).toBeInTheDocument()
    expect(screen.getByText('Quarto Standard')).toBeInTheDocument()
  })

  it('When user taps a room, wizard advances to room details', async () => {
    server.use(
      http.get('/booking/rooms', () => HttpResponse.json(MOCK_ROOMS)),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderWizard(makeJwt(exp))

    await waitFor(() => {
      expect(screen.getByText('Suíte Master')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Suíte Master'))

    await waitFor(() => {
      expect(screen.getByText(ptBR.description)).toBeInTheDocument()
      expect(screen.getByText(ptBR.reserveBtn)).toBeInTheDocument()
    })
  })

  it('When user confirms room on details and POST /booking/select returns 200, wizard advances to guest details', async () => {
    server.use(
      http.get('/booking/rooms', () => HttpResponse.json(MOCK_ROOMS)),
      http.post('/booking/select', () => HttpResponse.json({ reservationId: 'res-123' })),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderWizard(makeJwt(exp))

    await waitFor(() => {
      expect(screen.getByText('Suíte Master')).toBeInTheDocument()
    })

    // Step 1: click room to go to details
    fireEvent.click(screen.getByText('Suíte Master'))

    await waitFor(() => {
      expect(screen.getByText(ptBR.description)).toBeInTheDocument()
    })

    // Step 2: click "Reservar" on details page
    fireEvent.click(screen.getByText(ptBR.reserveBtn))

    await waitFor(() => {
      expect(screen.getByText(ptBR.guestDataTitle)).toBeInTheDocument()
    })

    expect(screen.getByTestId('countdown')).toBeInTheDocument()
  })

  it('When POST /booking/select returns ROOM_NOT_AVAILABLE, shows inline error and stays on room details', async () => {
    server.use(
      http.get('/booking/rooms', () => HttpResponse.json(MOCK_ROOMS)),
      http.post('/booking/select', () =>
        HttpResponse.json({ code: 'ROOM_NOT_AVAILABLE' }, { status: 409 }),
      ),
    )

    const exp = Math.floor(Date.now() / 1000) + 900
    renderWizard(makeJwt(exp))

    await waitFor(() => {
      expect(screen.getByText('Suíte Master')).toBeInTheDocument()
    })

    // Go to room details
    fireEvent.click(screen.getByText('Suíte Master'))

    await waitFor(() => {
      expect(screen.getByText(ptBR.description)).toBeInTheDocument()
    })

    // Try to reserve
    fireEvent.click(screen.getByText(ptBR.reserveBtn))

    await waitFor(() => {
      expect(screen.getByText(ptBR.errorRoomNotAvailable)).toBeInTheDocument()
    })

    // Wizard stays on room details — room name still visible
    expect(screen.getByText('Suíte Master')).toBeInTheDocument()
  })
})

// ── Integration: Guest details step ──────────────────────────────────────────

describe('Integration: Guest details step', () => {
  function renderGuestStep(onNext = vi.fn(), setGuestDetails = vi.fn()) {
    render(
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <BookingContext.Provider
          value={{
            selectedRoom: MOCK_ROOM,
            reservationId: 'res-1',
            guestDetails: null,
            setSelectedRoom: vi.fn(),
            setReservationId: vi.fn(),
            setGuestDetails,
          }}
        >
          <GuestDetailsStep onNext={onNext} onBack={vi.fn()} />
        </BookingContext.Provider>
      </IntlProvider>,
    )
    return { onNext, setGuestDetails }
  }

  it('When user submits with invalid email, form does not advance and shows validation error', () => {
    const { onNext, setGuestDetails } = renderGuestStep()

    fireEvent.change(screen.getByLabelText(ptBR.fullName), { target: { value: 'Maria Silva' } })
    fireEvent.change(screen.getByLabelText(ptBR.email), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText(ptBR.phone), { target: { value: '+5511987654321' } })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(screen.getByText(ptBR.emailInvalid)).toBeInTheDocument()
    expect(onNext).not.toHaveBeenCalled()
    expect(setGuestDetails).not.toHaveBeenCalled()
  })

  it('When user submits valid name, email, and phone, advances wizard and stores values in context', () => {
    const { onNext, setGuestDetails } = renderGuestStep()

    fireEvent.change(screen.getByLabelText(ptBR.fullName), { target: { value: 'Maria da Silva' } })
    fireEvent.change(screen.getByLabelText(ptBR.email), { target: { value: 'maria@example.com' } })
    fireEvent.change(screen.getByLabelText(ptBR.phone), { target: { value: '+5511987654321' } })
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))

    expect(setGuestDetails).toHaveBeenCalledWith({
      name: 'Maria da Silva',
      email: 'maria@example.com',
      phone: '+5511987654321',
    })
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})

// ── Integration: Countdown expiry ────────────────────────────────────────────

describe('Integration: Countdown expiry during flow', () => {
  it('When countdown reaches 0 mid-flow, route changes to /booking/expired', async () => {
    vi.useFakeTimers()

    server.use(
      http.get('/booking/rooms', () => HttpResponse.json(MOCK_ROOMS)),
    )

    const exp = Math.floor(Date.now() / 1000) + 5
    renderWizard(makeJwt(exp))

    await act(async () => { vi.advanceTimersByTime(6000) })

    expect(screen.getByTestId('expired-page')).toBeInTheDocument()

    vi.useRealTimers()
  })
})
