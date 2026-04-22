import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EventBus, EVENT_BUS } from '@/common/messaging'
import { DomainEvents, PropertyTrialExpiringPayload } from '@/common/events'
import { PropertyRepository, IdentityStaffMemberRepository } from '@/identity/persist'
import { PropertyEntity } from '@/identity/persist/entities/property'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

@Injectable()
export class TrialExpirationJob {
  private readonly logger = new Logger(TrialExpirationJob.name)

  constructor(
    private readonly propertyRepo: PropertyRepository,
    private readonly staffRepo: IdentityStaffMemberRepository,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async run(): Promise<void> {
    const now       = new Date()
    const warnUntil = new Date(now.getTime() + TWO_DAYS_MS)

    const [expired, expiringSoon] = await Promise.all([
      this.propertyRepo.findTrialPropertiesExpiring(now),
      this.propertyRepo.findTrialPropertiesExpiring(warnUntil),
    ])

    await this.suspendProperties(expired)

    const expiredIds = new Set(expired.map(p => p.id))
    const toWarn     = expiringSoon.filter(p => !expiredIds.has(p.id))

    await this.warnProperties(toWarn)
  }

  private async suspendProperties(entities: PropertyEntity[]): Promise<void> {
    if (entities.length === 0) return
    await this.propertyRepo.suspendManyByIds(entities.map(e => e.id))
    for (const entity of entities) {
      this.logger.log(`Property ${entity.externalId} suspended: trial expired`)
    }
  }

  private async warnProperties(entities: PropertyEntity[]): Promise<void> {
    if (entities.length === 0) return

    const admins = await this.staffRepo.findAdminsByPropertyIds(entities.map(e => e.externalId))

    await Promise.all(entities.map(async entity => {
      const admin = admins.get(entity.externalId)
      if (!admin) return

      await this.eventBus.publish<PropertyTrialExpiringPayload>(
        DomainEvents.PROPERTY_TRIAL_EXPIRING,
        {
          propertyId:     entity.externalId,
          adminEmail:     admin.email,
          trialExpiresAt: entity.trialExpiresAt!.toISOString(),
        },
      )

      this.logger.log(`Property ${entity.externalId} trial warning sent to ${admin.email}`)
    }))
  }
}
