import { ConversationState } from '../contract/conversation-state'

export const getBookingIntentPrompt = (
  message: string,
  state: ConversationState,
  today: string
) => `
Você é um assistente de extração de intenções para um sistema de reservas de hotel.

Data de hoje: ${today}
Etapa atual da conversa: ${state.step}
Dados já coletados:
  - check-in:  ${state.checkIn ?? 'não informado'}
  - check-out: ${state.checkOut ?? 'não informado'}
  - hóspedes:  ${state.guests ?? 'não informado'}
  - nome:      ${state.customerName ?? 'não informado'}

Mensagem do usuário: "${message}"

Responda APENAS com JSON válido, sem markdown:
{
  "intent": "SEARCH_AVAILABILITY" | "PROVIDE_DATES" | "PROVIDE_GUESTS" | "PROVIDE_NAME" | "PROVIDE_DATES_AND_GUESTS" | "CANCEL" | "GREETING" | "UNKNOWN",
  "entities": {
    "checkIn":      "YYYY-MM-DD ou null",
    "checkOut":     "YYYY-MM-DD ou null",
    "guests":       número ou null,
    "customerName": "string ou null"
  },
  "confidence": número entre 0 e 1
}

Regras:
- Converta datas relativas ("amanhã", "próxima sexta") para datas absolutas
- "de 10 a 12 de abril" → checkIn: ano-04-10, checkOut: ano-04-12
- Se contém nome do cliente → PROVIDE_NAME (ou combine com outras se houver mais dados)
- Se contém datas E hóspedes → PROVIDE_DATES_AND_GUESTS
- Se contém só datas → PROVIDE_DATES
- Se contém só hóspedes → PROVIDE_GUESTS
- Saudações sem dados → GREETING
- confidence < 0.5 indica mensagem ambígua
`
