import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@/common/config/service/config.service'
import { ConversationService, InboundWhatsAppMessage } from '../../core/service/conversation.service'
import { IntentExtractorService } from '../../core/service/intent-extractor.service'
import { ConversationFlowService } from '../../core/service/conversation-flow.service'
import { ConversationStateRepository } from '../../../conversation/persist'
import { ReservationAPI } from '@/reservation/external-api'
import { StayRepository, StayEntity } from '@/reservation/persist'
import { CONVERSATION_NOTIFIER, ConversationNotifier, ConversationState } from '../../core/contract'
import { NotificationChannel } from '@/notification/core/channels/channel.interface'
import { NOTIFICATION_CHANNELS } from '@/notification/core/channels/channel.interface'
import { ok } from 'neverthrow'

describe('Scenario: Full WhatsApp Reservation Flow', () => {
  let service: ConversationService
  let intentExtractor: jest.Mocked<IntentExtractorService>
  let stateRepo: jest.Mocked<ConversationStateRepository>
  let reservationAPI: jest.Mocked<ReservationAPI>
  let stayRepo: jest.Mocked<StayRepository>
  let notifier: jest.Mocked<ConversationNotifier>

  const PHONE = '+5511999990000'
  const STAY_ID = 'stay-123'
  const TO_WHATSAPP = 'whatsapp:+5511988887777'

  beforeEach(async () => {
    intentExtractor = { extract: jest.fn() } as any
    stateRepo = {
      isProcessed: jest.fn().mockResolvedValue(false),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    } as any
    reservationAPI = {
      generate: jest.fn(),
      findStayIdByWhatsAppNumber: jest.fn().mockResolvedValue(STAY_ID),
      findBotStaffId: jest.fn().mockResolvedValue('bot-staff-id'),
    } as any
    stayRepo = { findOneById: jest.fn() } as any
    notifier = { reply: jest.fn().mockResolvedValue(undefined) } as any
    
    // Mock do WhatsAppChannel
    const mockWhatsAppChannel: NotificationChannel = {
      supports: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(ok(undefined))
    } as any

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        ConversationFlowService,
        { provide: IntentExtractorService, useValue: intentExtractor },
        { provide: ConversationStateRepository, useValue: stateRepo },
        { provide: ReservationAPI, useValue: reservationAPI },
        { provide: StayRepository, useValue: stayRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000/booking') } },
        { provide: CONVERSATION_NOTIFIER, useValue: notifier },
        { provide: NOTIFICATION_CHANNELS, useValue: [mockWhatsAppChannel] },
      ],
    }).compile()

    service = module.get<ConversationService>(ConversationService)
  })

  const makeMessage = (body: string): InboundWhatsAppMessage => ({
    messageId: 'msg-' + Math.random(),
    from: `whatsapp:${PHONE}`,
    to: TO_WHATSAPP,
    body,
  })

  describe('Given a new customer starts a booking process', () => {
    it('When they provide only dates, Then the system should ask for the number of guests', async () => {
      // Setup: No state yet
      stateRepo.find.mockResolvedValue(null)
      
      // Intent: Providing dates
      intentExtractor.extract.mockResolvedValue({
        intent: 'PROVIDE_DATES',
        confidence: 0.9,
        entities: {
          checkIn: new Date('2030-10-10'),
          checkOut: new Date('2030-10-15'),
        }
      })

      await service.handle(makeMessage('Quero reservar de 10 a 15 de outubro'))

      // Verify the reply asks for guests
      expect(notifier.reply).toHaveBeenCalledWith(
        PHONE,
        STAY_ID,
        expect.stringContaining('Para quantas pessoas'),
        expect.any(String),
      )

      // Verify state was saved correctly
      expect(stateRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        step: 'ASK_GUESTS',
        checkIn: '2030-10-10T00:00:00.000Z',
        checkOut: '2030-10-15T00:00:00.000Z',
      }))
    })

    it('When they provide dates and guests, Then the system should ask for their name', async () => {
      // Setup: State has dates but no guests
      const state: ConversationState = {
        phone: PHONE,
        stayId: STAY_ID,
        step: 'ASK_GUESTS',
        checkIn: '2030-10-10T00:00:00.000Z',
        checkOut: '2030-10-15T00:00:00.000Z',
        messageCount: 1,
        updatedAt: new Date().toISOString()
      }
      stateRepo.find.mockResolvedValue(state)

      // Intent: Providing guests
      intentExtractor.extract.mockResolvedValue({
        intent: 'PROVIDE_GUESTS',
        confidence: 0.9,
        entities: { guests: 2 }
      })

      await service.handle(makeMessage('Para 2 pessoas'))

      // Verify the reply asks for name
      expect(notifier.reply).toHaveBeenCalledWith(
        PHONE,
        STAY_ID,
        expect.stringContaining('para quem seria a reserva'),
        expect.any(String),
      )

      expect(stateRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        step: 'ASK_NAME',
        guests: 2
      }))
    })

    it('When they provide their name after all other info, Then the system should generate the link', async () => {
      // Setup: State has dates and guests
      const state: ConversationState = {
        phone: PHONE,
        stayId: STAY_ID,
        step: 'ASK_NAME',
        checkIn: '2030-10-10T00:00:00.000Z',
        checkOut: '2030-10-15T00:00:00.000Z',
        guests: 2,
        messageCount: 2,
        updatedAt: new Date().toISOString()
      }
      stateRepo.find.mockResolvedValue(state)

      // Mock Stay
      stayRepo.findOneById.mockResolvedValue(new StayEntity({
        externalId: STAY_ID,
        name: 'Pousada do Sol',
        phone: '123'
      }))

      // Intent: Providing name
      intentExtractor.extract.mockResolvedValue({
        intent: 'PROVIDE_NAME',
        confidence: 0.9,
        entities: { customerName: 'Everton Paixão' }
      })

      // Mock Link Generation
      reservationAPI.generate.mockResolvedValue(ok({
        token: 'signed-token',
        sessionId: 'session-123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }))

      await service.handle(makeMessage('Meu nome é Everton Paixão'))

      // Verify the reply contains the link and mentions the correct names
      expect(notifier.reply).toHaveBeenCalledWith(
        PHONE,
        STAY_ID,
        expect.stringContaining('Aqui está seu link de reserva'),
        expect.any(String),
      )

      expect(reservationAPI.generate).toHaveBeenCalledWith(expect.objectContaining({
        stayName: 'Pousada do Sol',
        customerName: 'Everton Paixão',
        stayId: STAY_ID
      }))

      expect(stateRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        step: 'LINK_SENT',
        customerName: 'Everton Paixão'
      }))
    })
  })

  describe('Given a message arrives for a WhatsApp number not linked to any stay', () => {
    it('When the service handles it, Then it returns a CHANNEL_NOT_CONFIGURED domain error and does not touch state', async () => {
      reservationAPI.findStayIdByWhatsAppNumber.mockResolvedValue(null)

      const result = await service.handle(makeMessage('Hi, I want to book'))

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toEqual(expect.objectContaining({
        code: 'CHANNEL_NOT_CONFIGURED',
      }))

      // Invariant: the message must not be marked as processed,
      // otherwise a retry after the stay is configured would be silently dropped.
      expect(stateRepo.markProcessed).not.toHaveBeenCalled()
    })
  })
})
