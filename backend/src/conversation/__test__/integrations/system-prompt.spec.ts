import { buildSystemPrompt } from '../../core/prompts'
import { makeState } from '../fixture/agent'

const TODAY = '2026-05-01'

describe('buildSystemPrompt', () => {
  describe('remaining message budget is not exposed to the LLM', () => {
    describe('Given the conversation is on its last allowed turn (messageCount = 7, MAX_MESSAGES = 8)', () => {
      it('When the prompt is built, Then it signals that only one message remains', () => {
        const prompt = buildSystemPrompt(makeState({ messageCount: 7 }), TODAY, 8)

        // `\b` is unreliable around non-ASCII letters, so anchor on whitespace.
        expect(prompt).toMatch(/(^|\s)(restam?\s+1\b|única\b|última\s+(mensagem|pergunta|resposta))/i)
      })
    })

    describe('Given the conversation is comfortably inside the window (messageCount = 1)', () => {
      it('When the prompt is built, Then it does NOT nudge the model toward wrapping up', () => {
        const prompt = buildSystemPrompt(makeState({ messageCount: 1 }), TODAY, 8)

        expect(prompt).not.toMatch(/(^|\s)última\s+(mensagem|pergunta|resposta)/i)
        expect(prompt).not.toMatch(/restam?\s+1\b/i)
      })
    })

    describe('Given the conversation is close to the limit but not on the last turn (messageCount = 6)', () => {
      it('When the prompt is built, Then the remaining budget is visible in some form', () => {
        const prompt = buildSystemPrompt(makeState({ messageCount: 6 }), TODAY, 8)

        expect(prompt).toMatch(
          /restam?\s+2\b|\b2\s+mensagens?\s+restantes?|\b6\s*\/\s*8\b|\b2\s+de\s+8\b/i,
        )
      })
    })
  })
})
