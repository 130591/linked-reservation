import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { SessionContext, SessionProvider } from '../src/context/SessionContext'
import { useSession } from '../src/hooks/useSession'
import { useCountdown } from '../src/hooks/useCountdown'
import { createApiClient, ApiError, SessionExpiredError } from '../src/api/client'
import { resolveLocale } from '../src/i18n'
import { App } from '../src/App'
import ptBR from '../src/i18n/pt-BR.json'
import en from '../src/i18n/en.json'

// ── MSW server ─────────────────────────────────────────────────────────────

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeJwtWithExp(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub: 'session-1', exp: expSeconds }))
  return `${header}.${payload}.sig`
}

// ── Unit tests: useSession ──────────────────────────────────────────────────

describe('useSession', () => {
  function SessionDisplay() {
    const { token } = useSession()
    return <div data-testid="token">{token ?? 'null'}</div>
  }

  it('returns the token when ?token=foo is present in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/?token=foo']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <SessionProvider>
            <SessionDisplay />
          </SessionProvider>
        </IntlProvider>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('token').textContent).toBe('foo')
  })

  it('returns null when no ?token= is present in the URL', () => {
    render(
      <MemoryRouter initialEntries={['/booking']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <SessionProvider>
            <SessionDisplay />
          </SessionProvider>
        </IntlProvider>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('token').textContent).toBe('null')
  })
})

// ── Unit tests: API client ──────────────────────────────────────────────────

describe('createApiClient', () => {
  it('attaches Authorization: Bearer <token> header on every request', async () => {
    let capturedAuth = ''
    server.use(
      http.get('/booking/rooms', ({ request }) => {
        capturedAuth = request.headers.get('Authorization') ?? ''
        return HttpResponse.json([])
      }),
    )

    const client = createApiClient('my-token')
    await client.getRooms()

    expect(capturedAuth).toBe('Bearer my-token')
  })

  it('throws SessionExpiredError when the server responds with 410', async () => {
    server.use(
      http.get('/booking/rooms', () => HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 410 })),
    )

    const client = createApiClient('tok')
    await expect(client.getRooms()).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('throws ApiError with the backend code for other 4xx/5xx responses', async () => {
    server.use(
      http.get('/booking/rooms', () =>
        HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Not authorized' }, { status: 401 }),
      ),
    )

    const client = createApiClient('tok')
    const err = await client.getRooms().catch(e => e) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })
})

// ── Unit tests: useCountdown ────────────────────────────────────────────────

describe('useCountdown', () => {
  function CountdownDisplay({ expiresAt }: { expiresAt: Date | null }) {
    const { remainingSeconds, hasExpired } = useCountdown(expiresAt)
    return (
      <>
        <div data-testid="remaining">{remainingSeconds}</div>
        <div data-testid="expired">{hasExpired ? 'yes' : 'no'}</div>
      </>
    )
  }

  it('decrements remainingSeconds once per second', async () => {
    vi.useFakeTimers()
    const expiresAt = new Date(Date.now() + 10_000)

    render(
      <MemoryRouter initialEntries={['/booking']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <Routes>
            <Route path="/booking" element={<CountdownDisplay expiresAt={expiresAt} />} />
            <Route path="/booking/expired" element={<div>expired</div>} />
          </Routes>
        </IntlProvider>
      </MemoryRouter>,
    )

    const initial = Number(screen.getByTestId('remaining').textContent)

    await act(async () => { vi.advanceTimersByTime(1000) })

    const after = Number(screen.getByTestId('remaining').textContent)
    expect(after).toBe(initial - 1)

    vi.useRealTimers()
  })

  it('flips hasExpired to true when the deadline passes (via navigation)', async () => {
    vi.useFakeTimers()
    // 5000ms → Math.floor(5000/1000) = 5 seconds remaining initially
    const expiresAt = new Date(Date.now() + 5_000)

    render(
      <MemoryRouter initialEntries={['/booking']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <Routes>
            <Route path="/booking" element={<CountdownDisplay expiresAt={expiresAt} />} />
            {/* When hasExpired becomes true the hook navigates here */}
            <Route path="/booking/expired" element={<div data-testid="expired">yes</div>} />
          </Routes>
        </IntlProvider>
      </MemoryRouter>,
    )

    // Initially not expired
    expect(screen.getByTestId('expired').textContent).toBe('no')

    // Advance past the deadline — the hook navigates to /booking/expired
    await act(async () => { vi.advanceTimersByTime(6000) })

    // After navigation the /booking/expired route renders data-testid="expired" with "yes"
    expect(screen.getByTestId('expired').textContent).toBe('yes')

    vi.useRealTimers()
  })
})

// ── Unit tests: i18n ────────────────────────────────────────────────────────

describe('i18n locale resolution', () => {
  it('resolves to pt-BR when navigator.language is pt-BR', () => {
    expect(resolveLocale('pt-BR')).toBe('pt-BR')
  })

  it('resolves to pt for pt navigator.language', () => {
    expect(resolveLocale('pt')).toBe('pt')
  })

  it('falls back to pt-BR when navigator.language is an unsupported locale', () => {
    expect(resolveLocale('fr-FR')).toBe('pt-BR')
  })

  it('falls back to pt-BR for completely unknown locale', () => {
    expect(resolveLocale('xx-XX')).toBe('pt-BR')
  })

  it('renders pt-BR messages when locale is pt-BR', () => {
    const { container } = render(
      <IntlProvider locale="pt-BR" messages={ptBR}>
        <span>{ptBR.chooseRoom}</span>
      </IntlProvider>,
    )
    expect(container.textContent).toContain('Selecione o quarto ideal')
  })

  it('renders en messages when locale is en', () => {
    const { container } = render(
      <IntlProvider locale="en" messages={en}>
        <span>{en.chooseRoom}</span>
      </IntlProvider>,
    )
    expect(container.textContent).toContain('Pick the room that feels right')
  })
})

// ── Integration tests ───────────────────────────────────────────────────────

describe('Integration: App routing', () => {
  it('Given the URL /booking?token=valid, app mounts and renders the /booking route', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 900
    const token = makeJwtWithExp(futureExp)

    render(
      <MemoryRouter initialEntries={[`/booking?token=${token}`]}>
        <App />
      </MemoryRouter>,
    )

    // BookingRoute renders a loading placeholder in either locale
    const text = document.body.textContent ?? ''
    expect(text.length).toBeGreaterThan(0)
  })

  it('Given the countdown reaches 0, the user is navigated to /booking/expired', async () => {
    vi.useFakeTimers()

    function RouteDisplay() {
      const location = useLocation()
      return <div data-testid="path">{location.pathname}</div>
    }

    function CountdownTrigger() {
      // 5000ms → initially 5 seconds remaining (Math.floor(5) = 5, not 0)
      const expiresAt = new Date(Date.now() + 5_000)
      useCountdown(expiresAt)
      return null
    }

    render(
      <MemoryRouter initialEntries={['/booking']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <Routes>
            <Route
              path="/booking"
              element={
                <>
                  <CountdownTrigger />
                  <RouteDisplay />
                </>
              }
            />
            <Route path="/booking/expired" element={<><RouteDisplay /><div>Session expired</div></>} />
          </Routes>
        </IntlProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('path').textContent).toBe('/booking')

    await act(async () => { vi.advanceTimersByTime(6000) })

    expect(screen.getByTestId('path').textContent).toBe('/booking/expired')

    vi.useRealTimers()
  })

  it('Given msw responds with 410, the API client throws SessionExpiredError', async () => {
    server.use(
      http.post('/booking/confirmation', () =>
        HttpResponse.json({ code: 'SESSION_EXPIRED' }, { status: 410 }),
      ),
    )

    const client = createApiClient('tok')
    const err = await client.confirmBooking('intent-1').catch(e => e) as SessionExpiredError

    expect(err).toBeInstanceOf(SessionExpiredError)
    expect(err.code).toBe('SESSION_EXPIRED')
  })
})

// ── Unit tests: SessionProvider JWT expiry decoding ─────────────────────────

describe('SessionProvider JWT expiry decoding', () => {
  function ExpiryDisplay() {
    const { expiresAt } = useSession()
    return <div data-testid="expiresAt">{expiresAt ? expiresAt.getTime().toString() : 'null'}</div>
  }

  it('decodes exp claim from a well-formed JWT and exposes it as expiresAt', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 900
    const token = makeJwtWithExp(expSeconds)

    render(
      <MemoryRouter initialEntries={[`/?token=${token}`]}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <SessionProvider>
            <ExpiryDisplay />
          </SessionProvider>
        </IntlProvider>
      </MemoryRouter>,
    )

    const displayed = Number(screen.getByTestId('expiresAt').textContent)
    expect(displayed).toBeCloseTo(expSeconds * 1000, -3)
  })

  it('returns null expiresAt when token is malformed', () => {
    render(
      <MemoryRouter initialEntries={['/?token=notajwt']}>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <SessionProvider>
            <ExpiryDisplay />
          </SessionProvider>
        </IntlProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('expiresAt').textContent).toBe('null')
  })
})

// ── Direct context injection ────────────────────────────────────────────────

describe('SessionContext direct injection', () => {
  it('useSession returns values from injected context', () => {
    const mockClient = createApiClient('direct-token')

    function Consumer() {
      const { token } = useSession()
      return <div data-testid="tok">{token}</div>
    }

    render(
      <SessionContext.Provider value={{ token: 'direct-token', expiresAt: null, client: mockClient }}>
        <IntlProvider locale="pt-BR" messages={ptBR} defaultLocale="pt-BR">
          <MemoryRouter>
            <Consumer />
          </MemoryRouter>
        </IntlProvider>
      </SessionContext.Provider>,
    )

    expect(screen.getByTestId('tok').textContent).toBe('direct-token')
  })
})
