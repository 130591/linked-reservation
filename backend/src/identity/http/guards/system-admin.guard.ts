import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Request } from 'express'
import { ConfigService } from '@/common/config'

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const key = request.headers?.['x-admin-key'] as string | undefined

    if (key && key === this.config.get('systemAdminKey')) {
      return true
    }

    throw new ForbiddenException('Not authorized')
  }
}
