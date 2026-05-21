import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { type ThemeTokens, defaultTheme } from './tokens'
import { deepMerge, type DeepPartial } from './merge'

const ThemeContext = createContext<ThemeTokens>(defaultTheme)

interface ThemeProviderProps {
  overrides?: DeepPartial<ThemeTokens>
  children: ReactNode
}

export function ThemeProvider({ overrides, children }: ThemeProviderProps) {
  const theme = useMemo(
    () => (overrides ? deepMerge(defaultTheme, overrides) : defaultTheme),
    [overrides],
  )
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext)
}
