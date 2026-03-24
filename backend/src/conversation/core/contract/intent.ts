export type IntentType =
  | 'SEARCH_AVAILABILITY'
  | 'PROVIDE_DATES'
  | 'PROVIDE_GUESTS'
  | 'PROVIDE_DATES_AND_GUESTS'
  | 'CANCEL'
  | 'GREETING'
  | 'PROVIDE_NAME'
  | 'UNKNOWN'

export interface ExtractedEntities {
  checkIn?: Date
  checkOut?: Date
  guests?: number
  customerName?: string
}

export interface ExtractedIntent {
  intent: IntentType
  entities: ExtractedEntities
  confidence: number
}