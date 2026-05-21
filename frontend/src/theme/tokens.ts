export interface ThemeTokens {
  color: {
    bg: string
    surface: string
    ink: string
    muted: string
    hair: string
    hairSoft: string
    accent: string
    accentInk: string
    error: string
  }
  font: {
    sans: string
    mono: string
  }
  fontSize: {
    xs: number
    sm: number
    base: number
    md: number
    lg: number
    xl: number
    h2: number
    h1: number
  }
  fontWeight: {
    normal: number
    medium: number
    semibold: number
    bold: number
  }
  space: {
    xs: number
    sm: number
    md: number
    lg: number
    xl: number
    xxl: number
  }
  radius: {
    sm: number
    md: number
    lg: number
    xl: number
    pill: number
  }
}

export const defaultTheme: ThemeTokens = {
  color: {
    bg: '#ffffff',
    surface: '#f7f6f4',
    ink: '#111111',
    muted: '#6b6b6b',
    hair: 'rgba(17,17,17,0.10)',
    hairSoft: 'rgba(17,17,17,0.06)',
    accent: '#111111',
    accentInk: '#ffffff',
    error: '#c0392b',
  },
  font: {
    sans: '"Inter", -apple-system, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  fontSize: { xs: 10, sm: 11, base: 13, md: 14, lg: 16, xl: 18, h2: 22, h1: 24 },
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  radius: { sm: 4, md: 8, lg: 10, xl: 12, pill: 999 },
}
