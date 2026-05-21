import type { CSSProperties } from 'react'
import type { ThemeTokens } from './tokens'

export function pageShell(t: ThemeTokens): CSSProperties {
  return {
    height: '100%',
    background: t.color.bg,
    color: t.color.ink,
    fontFamily: t.font.sans,
    display: 'flex',
    flexDirection: 'column',
  }
}

export function stepTitle(t: ThemeTokens): CSSProperties {
  return {
    fontSize: t.fontSize.h2,
    lineHeight: 1.2,
    fontWeight: t.fontWeight.semibold,
    letterSpacing: -0.2,
  }
}

export function subtitle(t: ThemeTokens): CSSProperties {
  return {
    fontSize: t.fontSize.base,
    color: t.color.muted,
    marginTop: t.space.xs,
  }
}

export function backButton(t: ThemeTokens): CSSProperties {
  return {
    background: 'transparent',
    border: 0,
    padding: 0,
    cursor: 'pointer',
    color: t.color.muted,
    fontSize: t.fontSize.base,
    display: 'flex',
    alignItems: 'center',
    gap: t.space.xs,
    marginBottom: t.space.lg,
  }
}

export function caption(t: ThemeTokens): CSSProperties {
  return {
    fontSize: t.fontSize.xs,
    color: t.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: t.fontWeight.medium,
  }
}

export function cardBox(t: ThemeTokens): CSSProperties {
  return {
    border: `1px solid ${t.color.hair}`,
    borderRadius: t.radius.lg,
    padding: `${t.space.md + 2}px ${t.space.md + 2}px`,
    background: t.color.surface,
  }
}

export function inputBase(t: ThemeTokens): CSSProperties {
  return {
    width: '100%',
    border: `1px solid ${t.color.hair}`,
    borderRadius: t.radius.md,
    padding: '11px 12px',
    fontFamily: t.font.sans,
    fontSize: t.fontSize.md,
    color: t.color.ink,
    background: t.color.bg,
    outline: 'none',
  }
}

export function inputError(t: ThemeTokens): CSSProperties {
  return {
    ...inputBase(t),
    borderColor: t.color.error,
  }
}
