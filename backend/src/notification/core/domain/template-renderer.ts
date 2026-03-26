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

    return this.load(eventType, channel)
      .andThen((template) =>
        Result.fromThrowable(
          () => template(context),
          (error) =>
            NotificationError.TEMPLATE_RENDER_FAILED(
              templateId,
              String(error)
            )
        )()
      )
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

    return Result.fromThrowable(
      () => readFileSync(filepath, 'utf-8'),
      () => NotificationError.TEMPLATE_NOT_FOUND(`${eventType}/${channel.toLowerCase()}`)
    )()
  }

  private load(
    eventType: string,
    channel: string
  ): Result<HandlebarsTemplateDelegate, TemplateNotFoundError> {
      const key = `${eventType}.${channel}`
      const cached = this.cache.get(key)
      if (cached) return ok(cached)
      
      return this.readFile(eventType, channel)
        .map((content) => {
          const compiled = Handlebars.compile(content)
          this.cache.set(key, compiled)
          this.logger.log(`Template ${key} loaded`)
          return compiled
        })
  }












}