/**
 * Theme provider — locked to light mode app-wide for v1.
 *
 * The app does not follow the device dark-mode setting yet. This forces
 * NativeWind's color scheme to 'light' so every `dark:` variant is a no-op.
 * `setPref` is preserved as a no-op so a future settings toggle compiles.
 */

import React, { createContext, useContext, useEffect } from 'react'
import { useColorScheme as useNwColorScheme } from 'nativewind'

type ThemePref = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  pref: ThemePref
  scheme: 'light' | 'dark'
  setPref: (next: ThemePref) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useNwColorScheme()

  useEffect(() => {
    setColorScheme('dark')
  }, [setColorScheme])

  return (
    <ThemeContext.Provider
      value={{ pref: 'dark', scheme: 'dark', setPref: () => {} }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { pref: 'dark', scheme: 'dark', setPref: () => {} }
  return ctx
}
