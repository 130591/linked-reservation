import { Inject, Injectable } from '@nestjs/common'
import { ManagementClient } from 'auth0'
import { Result, ResultAsync } from 'neverthrow'
import { DomainError } from '@/common/exceptions'
import { EVENT_BUS, EventBus } from '@/common/messaging'
import { DomainEvents, PropertyProvisionedPayload } from '@/common/events'
import { PropertyRepository } from '@/identity/persist'
import { PropertyEntity, PropertyType } from '@/identity/persist'
import { AUTH0_MANAGEMENT } from '@/identity/core/contract'

export interface ProvisionPropertyCommand {
  name:       string
  type:       PropertyType
  adminEmail: string
  adminName:  string
}

export interface ProvisionPropertyResult {
  propertyId:  string
  auth0UserId: string
}

const TRIAL_DAYS = 7

@Injectable()
export class ProvisionPropertyService {
  constructor(
    private readonly propertyRepo: PropertyRepository,
    @Inject(AUTH0_MANAGEMENT) private readonly auth0: ManagementClient,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async handle(command: ProvisionPropertyCommand): Promise<Result<ProvisionPropertyResult, DomainError>> {
    const property = await this.propertyRepo.save(
      new PropertyEntity({
        name:           command.name,
        type:           command.type,
        status:         'trial',
        trialExpiresAt: this.trialExpiresAt(),
      }),
    )

    return ResultAsync
      .fromPromise(this.createAuth0User(command, property.id), () => DomainError.AUTH0_USER_CREATION_FAILED())
      .andThen(auth0UserId => ResultAsync.fromPromise(
        this.eventBus.publish<PropertyProvisionedPayload>(
          DomainEvents.PROPERTY_PROVISIONED,
          { propertyId: property.id, adminEmail: command.adminEmail },
        ),
        () => DomainError.EVENT_PUBLISH_FAILED(),
      ).map(() => ({ propertyId: property.id, auth0UserId })))
  }

  private trialExpiresAt(): Date {
    const date = new Date()
    date.setDate(date.getDate() + TRIAL_DAYS)
    return date
  }

  private async createAuth0User(command: ProvisionPropertyCommand, propertyId: string): Promise<string> {
    const user = await this.auth0.users.create({
      email:      command.adminEmail,
      name:       command.adminName,
      connection: 'Username-Password-Authentication',
      app_metadata: { propertyId, role: 'property_admin' },
    })
    return user.data.user_id!
  }
}