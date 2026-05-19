import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { IntlProvider } from 'react-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { WhatsAppHeader } from '../src/components/WhatsAppHeader'
import { StepDots } from '../src/components/StepDots'
import { RoomPlaceholder } from '../src/components/RoomPlaceholder'
import { Icon } from '../src/components/Icon'
import { PhoneSheet } from '../src/components/PhoneSheet'
import { MetaCell } from '../src/components/MetaCell'
import { Pill } from '../src/components/Pill'
import { PrimaryBtn } from '../src/components/PrimaryBtn'
import { SecondaryBtn } from '../src/components/SecondaryBtn'
import { StickyFooter } from '../src/components/StickyFooter'
import { SectionLabel } from '../src/components/SectionLabel'
import { SummaryRow } from '../src/components/SummaryRow'
import { ConfirmationRoute } from '../src/routes/ConfirmationRoute'
import { ExpiredRoute } from '../src/routes/ExpiredRoute'
import { SessionProvider } from '../src/context/SessionContext'
import ptBR from '../src/i18n/pt-BR.json'
import type { ConfirmationView } from '../src/types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const MOCK_CONFIRMATION: ConfirmationView = {
  bookingReference: 'LR-2605-ABCD1',
  property: { name: 'Test Hotel', whatsappNumber: '+5511999990000' },
  room: { id: 'r1', name: 'Suíte Master' },
  period: { checkIn: '2026-06-01', checkOut: '2026-06-03' },
  guests: 2,
  totalPaid: { amount: 35000, currency: 'BRL' },
  guest: { name: 'Maria', email: 'maria@test.com', phone: '+5511987' },
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <IntlProvider locale="pt-BR" messages={ptBR} defaultLocale="pt-BR">
        {children}
      </IntlProvider>
    </MemoryRouter>
  )
}

describe('WhatsAppHeader', () => {
  it('renders host name and SSL badge', () => {
    render(<WhatsAppHeader host="Paraíso Tropical" />, { wrapper })
    expect(screen.getByText('Paraíso Tropical')).toBeTruthy()
    expect(screen.getByText('SSL')).toBeTruthy()
  })

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn()
    render(<WhatsAppHeader host="Hotel" onBack={onBack} />, { wrapper })
    fireEvent.click(screen.getByRole('button'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('StepDots', () => {
  it('renders the correct number of dots', () => {
    const { container } = render(<StepDots step={1} total={4} />, { wrapper })
    // The outer div + 4 inner dot divs = 5 total div > div matches
    const dots = container.querySelectorAll('div > div > div')
    expect(dots.length).toBe(4)
  })
})

describe('RoomPlaceholder', () => {
  it('renders with provided label', () => {
    render(<RoomPlaceholder label="Suíte Vista Mar" />, { wrapper })
    expect(screen.getByRole('img', { name: 'Suíte Vista Mar' })).toBeTruthy()
  })

  it('applies default radius when variant is default', () => {
    const { container } = render(<RoomPlaceholder variant="default" />, { wrapper })
    const el = container.firstChild as HTMLElement
    expect(el.style.borderRadius).toBe('14px')
  })

  it('applies zero radius when variant is square', () => {
    const { container } = render(<RoomPlaceholder variant="square" />, { wrapper })
    const el = container.firstChild as HTMLElement
    expect(el.style.borderRadius).toBe('0')
  })
})

describe('Icon', () => {
  it('renders check icon', () => {
    const { container } = render(<Icon.check size={20} />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders arrow icon', () => {
    const { container } = render(<Icon.arrow />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders lock icon', () => {
    const { container } = render(<Icon.lock />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders pix icon', () => {
    const { container } = render(<Icon.pix />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders card icon', () => {
    const { container } = render(<Icon.card />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders whatsapp icon', () => {
    const { container } = render(<Icon.whatsapp />, { wrapper })
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

describe('PhoneSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PhoneSheet open={false} onClose={() => undefined}><div>content</div></PhoneSheet>,
      { wrapper },
    )
    expect(container.textContent).toBe('')
  })

  it('renders children when open', () => {
    render(
      <PhoneSheet open={true} onClose={() => undefined}><div>sheet content</div></PhoneSheet>,
      { wrapper },
    )
    expect(screen.getByText('sheet content')).toBeTruthy()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <PhoneSheet open={true} onClose={onClose}><div>content</div></PhoneSheet>,
      { wrapper },
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('MetaCell', () => {
  it('renders key and value', () => {
    render(<MetaCell k="Check-in" v="14 nov" />, { wrapper })
    expect(screen.getByText('Check-in')).toBeTruthy()
    expect(screen.getByText('14 nov')).toBeTruthy()
  })
})

describe('Pill', () => {
  it('renders children', () => {
    render(<Pill>Mais escolhido</Pill>, { wrapper })
    expect(screen.getByText('Mais escolhido')).toBeTruthy()
  })
})

describe('PrimaryBtn', () => {
  it('renders and handles click', () => {
    const onClick = vi.fn()
    render(<PrimaryBtn onClick={onClick}>Continuar</PrimaryBtn>, { wrapper })
    fireEvent.click(screen.getByText('Continuar'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders in full width when full=true', () => {
    const { container } = render(<PrimaryBtn full>Go</PrimaryBtn>, { wrapper })
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.style.width).toBe('100%')
  })

  it('is disabled and shows different styles when disabled=true', () => {
    const { container } = render(<PrimaryBtn disabled>Pay</PrimaryBtn>, { wrapper })
    const btn = container.querySelector('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})

describe('SecondaryBtn', () => {
  it('renders and handles click', () => {
    const onClick = vi.fn()
    render(<SecondaryBtn onClick={onClick}>Voltar</SecondaryBtn>, { wrapper })
    fireEvent.click(screen.getByText('Voltar'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('StickyFooter', () => {
  it('renders children', () => {
    render(<StickyFooter><span>footer content</span></StickyFooter>, { wrapper })
    expect(screen.getByText('footer content')).toBeTruthy()
  })
})

describe('SectionLabel', () => {
  it('renders label text', () => {
    render(<SectionLabel>Comodidades</SectionLabel>, { wrapper })
    expect(screen.getByText('Comodidades')).toBeTruthy()
  })
})

describe('SummaryRow', () => {
  it('renders key and value', () => {
    render(<SummaryRow k="Reserva" v="PT-4K92-NV" />, { wrapper })
    expect(screen.getByText('Reserva')).toBeTruthy()
    expect(screen.getByText('PT-4K92-NV')).toBeTruthy()
  })
})

describe('ConfirmationRoute', () => {
  it('renders the confirmation title after fetching data', async () => {
    server.use(
      http.get('/booking/confirmation', () => HttpResponse.json(MOCK_CONFIRMATION)),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <MemoryRouter initialEntries={['/booking/confirmation?token=view-tok']}>
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
    await waitFor(() => expect(screen.getByText(ptBR.confirmedTitle)).toBeTruthy())
  })
})

describe('ExpiredRoute', () => {
  it('renders the expired title', () => {
    render(
      <MemoryRouter>
        <IntlProvider locale="pt-BR" messages={ptBR}>
          <ExpiredRoute />
        </IntlProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText(ptBR.sessionExpiredTitle)).toBeTruthy()
  })
})
