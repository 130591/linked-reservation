import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Request } from 'express'
import { ReservationTokenService } from '@/reservation/core/service/reservation-token'
import { ReservationRepository } from '@/reservation/persist'

@Injectable()
export class ReservationViewTokenGuard implements CanActivate {
  constructor(
    private readonly tokenService: ReservationTokenService,
    private readonly reservationRepo: ReservationRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token   = this.extractToken(request)
    if (!token) throw new UnauthorizedException('Missing view token')

    const result = this.tokenService.verifyViewToken(token)
    if (!result) {
      this.throwExpiredOrUnauthorized(token)
    }

    const reservation = await this.reservationRepo.findOneById(result!.reservationId)
    if (!reservation) throw new UnauthorizedException('Reservation not found')

    request['reservation'] = reservation
    return true
  }

  private throwExpiredOrUnauthorized(token: string): never {
    const parts = token.split('.')
    if (parts.length === 3) {
      try {
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        if (
          claims.type === 'view' &&
          typeof claims.exp === 'number' &&
          claims.exp < Math.floor(Date.now() / 1000)
        ) {
          throw new GoneException('This booking confirmation link has expired')
        }
      } catch (err: any) {
        if (err?.status === 410) throw err
      }
    }
    throw new UnauthorizedException('Invalid view token')
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
    const queryToken = request.query['token']
    if (typeof queryToken === 'string') return queryToken
    return null
  }
}
