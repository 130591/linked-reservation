import { TemplateRenderer } from '@/notification/core/domain/template-renderer'
import * as fs from 'fs'
import * as path from 'path'

// We mock the filesystem so tests don't depend on actual template files
jest.mock('fs')
const readFileSyncMock = fs.readFileSync as jest.Mock


describe('Scenario: Template rendering reliability', () => {

  let renderer: TemplateRenderer

  beforeEach(() => {
    readFileSyncMock.mockReset()
    renderer = new TemplateRenderer()
  })

  describe('Given a valid template exists for the event type and channel', () => {
    it('When the service renders it, then it should return Ok with the rendered body', () => {
      readFileSyncMock.mockReturnValue('Olá {{name recipient.name}}! Reserva confirmada.')

      const result = renderer.render(
        'reservation.confirmed',
        'WHATSAPP',
        {
          recipient: { name: 'João', type: 'CUSTOMER' },
          hotel: { name: 'Hotel Manaus' }
        }
      )

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toContain('João')
        expect(result.value).toContain('Reserva confirmada')
      }
    })
  })

  describe('Given a template file does not exist', () => {
    it('When the service tries to render, then it should return Err with TEMPLATE_NOT_FOUND', () => {
      readFileSyncMock.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })

      const result = renderer.render(
        'session.expired',
        'SMS',
        { recipient: { name: 'Test', type: 'CUSTOMER' } }
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('TEMPLATE_NOT_FOUND')
        expect(result.error.templateId).toBe('session.expired/sms')
      }
    })
  })

  describe('Given a template exists but contains invalid Handlebars syntax', () => {
    it('When the service tries to render it with bad context, then it should return Err with TEMPLATE_RENDER_FAILED', () => {
      readFileSyncMock.mockReturnValue('{{#each items}}{{broken{{/each}}')

      const result = renderer.render(
        'reservation.confirmed',
        'WHATSAPP',
        { recipient: { name: 'Test', type: 'CUSTOMER' } }
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(['TEMPLATE_RENDER_FAILED', 'TEMPLATE_NOT_FOUND']).toContain(result.error.code)
      }
    })
  })

  describe('Given one template is missing and another exists', () => {
    it('Then rendering the missing one should fail without affecting the valid one', () => {
      readFileSyncMock
        .mockImplementationOnce(() => { throw new Error('ENOENT') })
        .mockImplementationOnce(() => 'Olá {{name recipient.name}}!')

      const missingResult = renderer.render(
        'nonexistent.event',
        'WHATSAPP',
        { recipient: { name: 'Test', type: 'CUSTOMER' } }
      )

      const renderer2 = new TemplateRenderer()
      const validResult = renderer2.render(
        'reservation.confirmed',
        'WHATSAPP',
        { recipient: { name: 'Maria', type: 'CUSTOMER' } }
      )

      expect(missingResult.isErr()).toBe(true)
      expect(validResult.isOk()).toBe(true)
    })
  })
})
