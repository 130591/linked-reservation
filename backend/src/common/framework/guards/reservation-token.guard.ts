import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  GoneException
} from '@nestjs/common'
import { Request } from 'express'
import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { ReservationSessionRepository } from '@/reservation/persist'

@Injectable()
export class ReservationTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: ReservationTokenService,
    private readonly sessionRepo: ReservationSessionRepository
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(request)
    if (!token) {
      throw new UnauthorizedException('Missing reservation token')
    }

    const sessionId = this.tokenService.verify(token)
    if (!sessionId) {
      throw new UnauthorizedException('Invalid reservation token')
    }

    const session = await this.sessionRepo.findOneById(sessionId)

    if (!session) {
      throw new UnauthorizedException('Session not found')
    }

    if (session.isExpired()) {
      throw new GoneException('This booking link has expired')
    }

    request['reservationSession'] = session

    return true
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }
    const queryToken = request.query['token']
    if (typeof queryToken === 'string') {
      return queryToken
    }

    return null
  }
}