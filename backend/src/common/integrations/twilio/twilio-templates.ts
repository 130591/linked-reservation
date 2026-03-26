/**
 * Twilio WhatsApp Templates
 * 
 * Templates pré-aprovados pelo WhatsApp para uso com Twilio
 */

export enum TwilioTemplateSid {
  APPOINTMENT_REMINDER = 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
  RESERVATION_CONFIRMED = 'your_template_sid_here',
  CHECKIN_REMINDER = 'your_template_sid_here',
  // Adicione outros templates conforme necessário
}

export interface TemplateVariables {
  [key: string]: string
}

export interface TwilioTemplateMessage {
  to: string
  templateSid: TwilioTemplateSid
  variables: TemplateVariables
}

/**
 * Exemplos de uso:
 * 
 * 1. Lembrete de agendamento:
 * await twilioService.sendWhatsAppTemplate('+5521974604635', TwilioTemplateSid.APPOINTMENT_REMINDER, {
 *   '1': '12/1',
 *   '2': '3pm'
 * })
 * 
 * 2. Confirmação de reserva:
 * await twilioService.sendWhatsAppTemplate(phone, TwilioTemplateSid.RESERVATION_CONFIRMED, {
 *   '1': guestName,
 *   '2': hotelName,
 *   '3': checkInDate,
 *   '4': checkOutDate
 * })
 */
