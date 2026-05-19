export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`
}
