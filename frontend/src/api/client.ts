import type {
  Room,
  ConfirmationView,
  PaymentStatusResult,
  CreatePaymentIntentBody,
  CreatePaymentIntentResult,
  ConfirmBookingResult,
} from '../types'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class SessionExpiredError extends ApiError {
  constructor() {
    super(410, 'SESSION_EXPIRED', 'Session expired')
    this.name = 'SessionExpiredError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 410) throw new SessionExpiredError()
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string; message?: string }
    throw new ApiError(res.status, body.code ?? 'UNKNOWN_ERROR', body.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function createApiClient(token: string | null, baseUrl = '') {
  function headers(): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { headers: headers() })
    return handleResponse<T>(res)
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    return handleResponse<T>(res)
  }

  return {
    getRooms: () => get<Room[]>('/booking/rooms'),
    selectRoom: (roomId: string) => post<{ reservationId: string }>('/booking/select', { roomId }),
    createPaymentIntent: (body: CreatePaymentIntentBody) =>
      post<CreatePaymentIntentResult>('/booking/payment-intent', body),
    getPaymentStatus: (intentId: string) =>
      get<PaymentStatusResult>(`/booking/payment-status?intentId=${encodeURIComponent(intentId)}`),
    confirmBooking: (intentId: string) =>
      post<ConfirmBookingResult>('/booking/confirmation', { intentId }),
    getConfirmation: () => get<ConfirmationView>('/booking/confirmation'),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
