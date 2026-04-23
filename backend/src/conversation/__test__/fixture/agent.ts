import type Anthropic from '@anthropic-ai/sdk'
import { ConversationState } from '../../core/contract'

export const DEFAULT_PHONE    = '+5511999990000'
export const DEFAULT_STAY_ID  = 'stay-123'
export const DEFAULT_DATE_ISO = '2026-04-22T10:00:00.000Z'

export function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    phone:          DEFAULT_PHONE,
    stayId:         DEFAULT_STAY_ID,
    step:           'INIT',
    messageCount:   0,
    messageHistory: [],
    updatedAt:      DEFAULT_DATE_ISO,
    ...overrides,
  }
}

export function textReply(text: string): Anthropic.Message {
  return {
    id:            'msg_text',
    type:          'message',
    role:          'assistant',
    model:         'claude-haiku-4-5-20251001',
    stop_reason:   'end_turn',
    stop_sequence: null,
    usage:         { input_tokens: 10, output_tokens: 20 },
    content:       [{ type: 'text', text, citations: [] }],
  } as unknown as Anthropic.Message
}

export function multiTextReply(...parts: string[]): Anthropic.Message {
  return {
    ...textReply(''),
    content: parts.map(text => ({ type: 'text', text, citations: [] })),
  } as unknown as Anthropic.Message
}

export function toolUseResponse(input: Record<string, unknown>): Anthropic.Message {
  return {
    id:            'msg_tool',
    type:          'message',
    role:          'assistant',
    model:         'claude-haiku-4-5-20251001',
    stop_reason:   'tool_use',
    stop_sequence: null,
    usage:         { input_tokens: 10, output_tokens: 20 },
    content:       [{ type: 'tool_use', id: 'toolu_1', name: 'confirm_booking', input }],
  } as unknown as Anthropic.Message
}
