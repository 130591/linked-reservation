import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { JWTPayload, createRemoteJWKSet } from 'jose'
import { Request } from 'express'
import { ConfigService } from '@/common/config'
import { PropertyRepository } from '@/identity/persist/repositories/property.repository'
import { IdentityStaffMemberRepository } from '@/identity/persist/repositories/identity-staff-member.repository'
import { Property } from '@/identity/core/domain/property'
import { IdentityRole } from '@/identity/persist/entities/identity-staff-member'

interface Auth0AppMetadata {
  propertyId: string
  role: IdentityRole
}

@Injectable()
export class Auth0JwtGuard implements CanActivate {
  private JWKS: Awaited<ReturnType<typeof createRemoteJWKSet>> | undefined
  private readonly audience: string

  constructor(
    private readonly config: ConfigService,
    private readonly staffRepo: IdentityStaffMemberRepository,
    private readonly propertyRepo: PropertyRepository,
  ) {
    this.audience = config.get('auth0Audience')
  }

  private async resolveJose() {
    const jose = await import('jose')
    if (!this.JWKS) {
      const jwksUrl = new URL(`https://${this.config.get('auth0Domain')}/.well-known/jwks.json`)
      this.JWKS = jose.createRemoteJWKSet(jwksUrl)
    }
    return jose
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractBearerToken(request)

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    const { jwtVerify } = await this.resolveJose()

    let payload: JWTPayload
    try {
      const result = await jwtVerify(token, this.JWKS!, {
        audience: this.audience,
        algorithms: ['RS256'],
      })
      payload = result.payload
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    const sub = payload.sub!
    const email = (payload['email'] ?? payload['https://linked-reservation/email']) as string
    const name = (payload['name'] ?? payload['https://linked-reservation/name']) as string

    const appMetadataKey = `https://${this.config.get('auth0Domain')}/app_metadata`
    const appMetadata = (payload[appMetadataKey] ?? payload['app_metadata']) as Auth0AppMetadata | undefined

    if (!appMetadata?.propertyId || !appMetadata?.role) {
      throw new ForbiddenException('Token missing required property context')
    }

    const { propertyId, role } = appMetadata

    const staffMember = await this.staffRepo.upsertByAuth0Sub({
      auth0Sub: sub,
      email,
      name,
      role,
      propertyId,
      active: true,
    })

    const propertyEntity = await this.propertyRepo.findOneById(propertyId)
    if (!propertyEntity) {
      throw new ForbiddenException('Property not found')
    }

    const propertyResult = Property.create(
      propertyEntity.externalId,
      propertyEntity.name,
      propertyEntity.type,
      propertyEntity.status,
      propertyEntity.trialExpiresAt,
    )
    if (propertyResult.isErr()) {
      throw new ForbiddenException(propertyResult.error.message)
    }

    const accessResult = propertyResult.value.checkAccess()
    if (accessResult.isErr()) {
      throw new ForbiddenException(accessResult.error.message)
    }

    (request as any)['staff'] = { id: staffMember.externalId, role: staffMember.role, propertyId: staffMember.propertyId }
    return true
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers?.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7)
    }
    return null
  }
}
