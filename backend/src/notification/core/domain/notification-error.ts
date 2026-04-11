export type NotificationErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_RENDER_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_DESTINATION'
  | 'NO_CHANNEL_IMPLEMENTATION'
  | 'QUIET_HOURS_SUPPRESSED'
  | 'ROUTING_RULE_INVALID'

export interface BaseNotificationError {
  readonly code: NotificationErrorCode
  readonly message: string
}

export interface TemplateNotFoundError extends BaseNotificationError {
  readonly code: 'TEMPLATE_NOT_FOUND'
  readonly templateId: string
}

export interface TemplateRenderError extends BaseNotificationError {
  readonly code: 'TEMPLATE_RENDER_FAILED'
  readonly templateId: string
  readonly cause: string
}

export interface ProviderError extends BaseNotificationError {
  readonly code: 'PROVIDER_UNAVAILABLE'
  readonly channel: string
  readonly retryable: true
}

export interface InvalidDestinationError extends BaseNotificationError {
  readonly code: 'INVALID_DESTINATION'
  readonly channel: string
  readonly destination: string
  readonly retryable: false
}

export interface RoutingRuleInvalidError extends BaseNotificationError {
  readonly code: 'ROUTING_RULE_INVALID'
  readonly ruleId: number
  readonly cause: string
}

export type NotificationError =
  | BaseNotificationError
  | TemplateNotFoundError
  | TemplateRenderError
  | ProviderError
  | InvalidDestinationError
  | RoutingRuleInvalidError

export const NotificationError = {
  TEMPLATE_NOT_FOUND: (templateId: string): TemplateNotFoundError => ({
    code: 'TEMPLATE_NOT_FOUND',
    templateId,
    message: `Template not found: ${templateId}. Create src/notification/templates/${templateId}.hbs`,
  }),

  TEMPLATE_RENDER_FAILED: (templateId: string, cause: string): TemplateRenderError => ({
    code: 'TEMPLATE_RENDER_FAILED',
    templateId,
    cause,
    message: `Failed to render template ${templateId}: ${cause}`,
  }),

  PROVIDER_UNAVAILABLE: (channel: string, reason: string): ProviderError => ({
    code: 'PROVIDER_UNAVAILABLE',
    channel,
    retryable: true,
    message: `Channel ${channel} is temporarily unavailable: ${reason}`,
  }),

  INVALID_DESTINATION: (channel: string, destination: string): InvalidDestinationError => ({
    code: 'INVALID_DESTINATION',
    channel,
    destination,
    retryable: false,
    message: `Invalid destination '${destination}' for channel ${channel}`,
  }),

  NO_CHANNEL_IMPLEMENTATION: (channel: string): BaseNotificationError => ({
    code: 'NO_CHANNEL_IMPLEMENTATION',
    message: `No implementation found for channel ${channel}`,
  }),

  ROUTING_RULE_INVALID: (ruleId: number, cause: string): RoutingRuleInvalidError => ({
    code: 'ROUTING_RULE_INVALID',
    ruleId,
    cause,
    message: `Routing rule ${ruleId} has invalid configuration: ${cause}`,
  }),
} as const
