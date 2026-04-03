import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Request } from 'express'
import { validateRequest } from 'twilio'
import { ConfigService } from '@/common/config'

@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get('env') !== 'production') {
      return true
    }

    const request = context.switchToHttp().getRequest<Request>()
    const signature = request.headers['x-twilio-signature'] as string | undefined

    if (!signature) {
      throw new UnauthorizedException('Missing Twilio signature')
    }

    const url = `${request.protocol}://${request.get('host')}${request.originalUrl}`
    const isValid = validateRequest(
      this.config.get('twilioAuthToken'),
      signature,
      url,
      request.body ?? {}
    )

    if (!isValid) {
      throw new UnauthorizedException('Invalid Twilio signature')
    }

    return true
  }
}
