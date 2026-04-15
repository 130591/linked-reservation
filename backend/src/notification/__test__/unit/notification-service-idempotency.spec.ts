import { Test, TestingModule } from '@nestjs/testing'
import { ok } from 'neverthrow'
import { NotificationService } from '../../core/service/notification-service'
import { NotificationRepository } from '../../persist/repositories/notification.repository'
import { TemplateRenderer } from '../../core/domain/template-renderer'
import { NOTIFICATION_CHANNELS, NotificationChannel } from '../../core/channels'
import { NotificationEvent, RecipientType } from '../../event'
import { DomainEvents } from '@/common/events'

// typeorm-transactional's @Transactional() requires a running transactional
// context. Replace it with a no-op in unit tests so we exercise the service
// logic without a real DB.
jest.mock('typeorm-transactional', () => ({
  Transactional: () => () => undefined,
}))

describe('NotificationService — idempotencyKey dedup', () => {
  let service: NotificationService
  let repo: jest.Mocked<NotificationRepository>
  let renderer: jest.Mocked<TemplateRenderer>
  let channel: jest.Mocked<NotificationChannel>

  const PHONE = '+5521999998888'
  const STAY_ID = 'stay-xyz'

  const makeEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
    type: DomainEvents.CONVERSATION_REPLY,
    recipients: [{
      id: PHONE,
      type: RecipientType.CUSTOMER,
      phone: PHONE,
      name: 'Cliente',
    }],
    payload: { message: 'oi', stayId: STAY_ID },
    ...overrides,
  })

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (entity) => ({ ...entity, id: 'notif-id' })),
      update: jest.fn().mockResolvedValue(undefined),
    } as any

    renderer = {
      render: jest.fn().mockReturnValue(ok('rendered body')),
    } as any

    channel = {
      supports: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(ok(undefined)),
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: repo },
        { provide: TemplateRenderer, useValue: renderer },
        { provide: NOTIFICATION_CHANNELS, useValue: [channel] },
      ],
    }).compile()

    service = module.get(NotificationService)
  })

  it('dispatches twice when no idempotencyKey is provided (non-idempotent events)', async () => {
    await service.dispatch(makeEvent())
    await service.dispatch(makeEvent())

    // No idempotency check should happen, and both calls render+send.
    expect(repo.findOne).not.toHaveBeenCalled()
    expect(channel.send).toHaveBeenCalledTimes(2)
  })

  it('dispatches the first time and drops the duplicate when the same idempotencyKey is reused', async () => {
    const key = 'SM-twilio-message-sid-123'

    // First dispatch: no existing record.
    repo.findOne.mockResolvedValueOnce(null)
    await service.dispatch(makeEvent({ idempotencyKey: key }))

    // Second dispatch with same key: repo reports an existing notification.
    repo.findOne.mockResolvedValueOnce({ id: 'prev' } as any)
    await service.dispatch(makeEvent({ idempotencyKey: key }))

    expect(repo.findOne).toHaveBeenCalledTimes(2)
    expect(repo.findOne).toHaveBeenLastCalledWith({
      where: { idempotencyKey: key, recipientId: PHONE, channel: 'WHATSAPP' },
    })
    // Only the first dispatch should have actually rendered/sent.
    expect(channel.send).toHaveBeenCalledTimes(1)
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('persists the idempotencyKey on the notification row', async () => {
    const key = 'SM-abc'
    await service.dispatch(makeEvent({ idempotencyKey: key }))

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: key }),
    )
  })
})
