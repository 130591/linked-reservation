import { ConversationState } from '../contract/conversation-state'

export const buildSystemPrompt = (state: ConversationState, today: string, maxMessages: number): string => {
  const collected: string[] = []
  if (state.checkIn)      collected.push(`check-in: ${state.checkIn}`)
  if (state.checkOut)     collected.push(`check-out: ${state.checkOut}`)
  if (state.guests)       collected.push(`hóspedes: ${state.guests}`)
  if (state.customerName) collected.push(`nome: ${state.customerName}`)

  const missing: string[] = []
  if (!state.checkIn || !state.checkOut) missing.push('datas de check-in e check-out')
  if (!state.guests)                     missing.push('número de hóspedes')

  const collectedSection = collected.length > 0
    ? collected.join('\n')
    : 'Nenhum dado coletado ainda.'

  const missingSection = missing.length > 0
    ? `AINDA PRECISA COLETAR: ${missing.join(' e ')}.`
    : 'Todos os dados obrigatórios foram coletados — chame confirm_booking agora.'

  const remaining = Math.max(0, maxMessages - state.messageCount)
  const budgetSection = buildBudgetSection(remaining)

  return `Você é um assistente de reservas via WhatsApp. Hoje é ${today}.

DADOS JÁ COLETADOS:
${collectedSection}

${missingSection}${budgetSection}

REGRAS:
- Seja natural e amigável, use emojis com moderação
- Responda dúvidas sobre a hospedagem normalmente antes de voltar ao fluxo
- O nome do cliente é opcional: colete se ele fornecer, mas não fique pedindo
- Só chame confirm_booking quando tiver check-in, check-out e hóspedes confirmados
- Nunca chame confirm_booking com dados faltando
- Se o usuário desistir explicitamente, despeça-se sem chamar a tool`
}

function buildBudgetSection(remaining: number): string {
  if (remaining <= 0) {
    return ''
  }
  if (remaining === 1) {
    return '\n\n⚠️ Esta é a última mensagem antes do handoff humano. Resolva agora ou peça ajuda.'
  }
  if (remaining <= 2) {
    return `\n\n⚠️ Restam ${remaining} mensagens antes do handoff humano — feche o fluxo logo.`
  }
  return ''
}
