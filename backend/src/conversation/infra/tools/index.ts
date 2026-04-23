import Anthropic from '@anthropic-ai/sdk'

export const CONFIRM_BOOKING_TOOL: Anthropic.Tool = {
  name: 'confirm_booking',
  description: [
    'Chame quando tiver coletado check-in, check-out e número de hóspedes.',
    'O nome do cliente é opcional — colete se fornecido, mas não bloqueie o fluxo esperando por ele.',
    'Nunca chame com checkIn ou checkOut faltando.',
  ].join(' '),
  input_schema: {
    type: 'object' as const,
    properties: {
      checkIn:      { type: 'string', description: 'Data de check-in no formato YYYY-MM-DD.' },
      checkOut:     { type: 'string', description: 'Data de check-out no formato YYYY-MM-DD.' },
      guests:       { type: 'number', description: 'Número de hóspedes.' },
      customerName: { type: 'string', description: 'Nome completo do cliente, se fornecido.' },
    },
    required: ['checkIn', 'checkOut', 'guests'],
  },
}