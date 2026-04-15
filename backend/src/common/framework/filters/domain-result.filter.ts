import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common'
import { Response } from 'express'
import { DomainError, DomainErrorCode } from '@/common/exceptions/domain-error'

const HTTP_STATUS: Record<DomainErrorCode, number> = {
  CHECK_IN_IN_PAST: 400,
  CHECK_OUT_BEFORE_CHECK_IN: 400,
  MINIMUM_DURATION_NOT_MET: 400,
  MAX_STAYING_DAYS_EXCEEDED: 400,
  NAME_REQUIRED: 400,
  INVALID_EMAIL: 400,
  INVALID_PHONE: 400,
  INVALID_CPF: 400,
  NO_ROOMS_FOR_CAPACITY: 400,
  PROPERTY_NOT_FOUND: 404,
  PROPERTY_SUSPENDED: 403,
  PROPERTY_TRIAL_EXPIRED: 403,
  STAFF_NOT_AUTHORIZED: 403,
  INVALID_PROPERTY_TYPE: 400,
  INVALID_PROPERTY_STATUS: 400,
  STAFF_INVITATION_FAILED: 500,
  AUTH0_USER_CREATION_FAILED: 500,
  EVENT_PUBLISH_FAILED: 500,
  ROOM_NOT_AVAILABLE: 409,
  SESSION_EXPIRED: 410,
  ROOM_NOT_FOUND: 404,
  CHANNEL_NOT_CONFIGURED: 400
}

@Catch()
export class DomainErrorFilter implements ExceptionFilter {  
  catch(exception: unknown, host: ArgumentsHost) {
    // Allow pass through to the default NestJS handler if it's not a domain error
    if (!this.isDomainError(exception)) throw exception

    const response = host.switchToHttp().getResponse<Response>()
    const status = HTTP_STATUS[exception.code]

    const { code, message, ...rest } = exception
    response.status(status).json({
      error: code,
      message,
      ...rest
    })
  }

  private isDomainError(exception: unknown): exception is DomainError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      'message' in exception &&
      (exception as DomainError).code in HTTP_STATUS
   )
  }
}