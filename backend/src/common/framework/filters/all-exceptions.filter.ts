import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost

    const ctx = host.switchToHttp()

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const responseBody = {
      error: {
        code: this.resolveCode(exception, httpStatus),
        message: this.resolveMessage(exception, httpStatus),
        request_id: null,
        details: null,
      },
    }

    if (httpStatus >= 500) {
      this.logger.error(responseBody, (exception as Error)?.stack)
    } else {
      this.logger.warn(responseBody)
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus)
  }

  private resolveCode(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      if (typeof response === 'object' && response !== null && 'error' in response) {
        const errorObj = (response as Record<string, unknown>).error
        if (typeof errorObj === 'object' && errorObj !== null && 'code' in errorObj) {
          return (errorObj as Record<string, unknown>).code as string
        }
      }
    }

    const codeMap: Record<number, string> = {
      400: 'invalid_request',
      401: 'unauthenticated',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      422: 'validation_failed',
      429: 'rate_limited',
      500: 'internal_error',
    }

    return codeMap[status] ?? 'internal_error'
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      if (typeof response === 'object' && response !== null) {
        if ('message' in response) {
          const msg = (response as any).message
          if (Array.isArray(msg)) return msg.join(', ')
          if (typeof msg === 'string') return msg
        }

        if ('error' in response) {
          const errorObj = (response as Record<string, unknown>).error
          if (typeof errorObj === 'object' && errorObj !== null && 'message' in errorObj) {
            return (errorObj as Record<string, unknown>).message as string
          }
        }
      }
      if (typeof response === 'string') return response
    }

    if (status >= 500) {
      return 'An unexpected error occurred'
    }

    return 'Request could not be processed'
  }
}
