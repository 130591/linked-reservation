import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EventBus, EVENT_BUS } from '@/common/messaging'
import { DomainEvents, PropertyTrialExpiringPayload } from '@/common/events'
import { PropertyRepository, IdentityStaffMemberRepository } from '@/identity/persist'
import { Property } from '../core/domain/property'
import { PropertyEntity } from '@/identity/persist'


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

    await Promise.all(expired.map(p => this.suspendProperty(p)))

    const expiredIds = new Set(expired.map(p => p.id))
    const toWarn     = expiringSoon.filter(p => !expiredIds.has(p.id))

    await Promise.all(toWarn.map(p => this.warnProperty(p)))
  }

  private async suspendProperty(property: Property): Promise<void> {
    const suspended = property.suspend()
    await this.propertyRepo.save(new PropertyEntity({
      id:             suspended.id,
      name:           suspended.name,
      type:           suspended.type,
      status:         suspended.status,
      trialExpiresAt: suspended.trialExpiresAt,
    }))
    this.logger.log(`Property ${property.id} suspended: trial expired`)
  }

  private async warnProperty(property: Property): Promise<void> {
    const admin = await this.staffRepo.findAdminByPropertyId(property.id)
    if (!admin) return

    await this.eventBus.publish<PropertyTrialExpiringPayload>(
      DomainEvents.PROPERTY_TRIAL_EXPIRING,
      {
        propertyId:     property.id,
        adminEmail:     admin.email,
        trialExpiresAt: property.trialExpiresAtOrThrow().toISOString(),
      },
    )

    this.logger.log(`Property ${property.id} trial warning sent to ${admin.email}`)
  }
}