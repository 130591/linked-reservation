import { Injectable, Logger } from '@nestjs/common'
import { readFileSync } from 'fs'
import * as Handlebars from 'handlebars'
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import { join } from 'path'
import { err, ok, Result } from 'neverthrow'
import { NotificationError, TemplateNotFoundError, TemplateRenderError } from './notification-error'


dayjs.locale('pt-br')

export interface TemplateContext {
  recipient: {
    name: string
    type: string
  }
  [key: string]: unknown
}

@Injectable()
export class TemplateRenderer {
  private readonly logger = new Logger(TemplateRenderer.name)

  private readonly cache = new Map<string, HandlebarsTemplateDelegate>()

  constructor() {
    this.registerHelpers()
  }

  render(
    eventType: string,
    channel: string,
    context: TemplateContext
  ): Result<string, TemplateNotFoundError | TemplateRenderError> {
    const templateId = `${eventType}.${channel}`
    const loadResult = this.load(eventType, channel)

    if (loadResult.isErr()) return err(loadResult.error)

    try {
      return ok(loadResult.value(context))
    } catch (error) {
      return err(NotificationError.TEMPLATE_RENDER_FAILED(templateId, String(error)))
    }
  }

  private registerHelpers() {
    Handlebars.registerHelper('formatDate', (date: string, format: string) => {
      if (!date) return ''
      return dayjs(date).format(format)
    })

    Handlebars.registerHelper('name', (value: string) => {
      return value || 'Cliente'
    })

    Handlebars.registerHelper('fallback', (value: unknown, defaultValue: string) => {
      return value ?? defaultValue
    })

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b)
  }

  private readFile(
    eventType: string,
    channel: string
  ): Result<string, TemplateNotFoundError> {
    const filename = `${channel.toLowerCase()}.hbs`
    const filepath = join(__dirname, '../../templates', eventType, filename)

    try {
      return ok(readFileSync(filepath, 'utf-8'))
    } catch {
      return err(NotificationError.TEMPLATE_NOT_FOUND(`${eventType}/${channel.toLowerCase()}`))
    }
  }

  private load(
    eventType: string,
    channel: string
  ): Result<HandlebarsTemplateDelegate, TemplateNotFoundError> {
    const key = `${eventType}.${channel}`
    const cached = this.cache.get(key)
    if (cached) {
      return ok(cached)
    }

    const readResult = this.readFile(eventType, channel)
    if (readResult.isErr()) return err(readResult.error)

    const compiled = Handlebars.compile(readResult.value)

    this.cache.set(key, compiled)
    this.logger.log(`Template ${key} loaded`)
    return ok(compiled)
  }
}