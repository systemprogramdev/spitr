'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, scanlines } = useUIStore()

  useEffect(() => {
    // Apply theme from store on mount and when it changes
    document.body.setAttribute('data-theme', theme)
    document.body.setAttribute('data-scanlines', scanlines.toString())
  }, [theme, scanlines])

  // Prevent flash of wrong theme by also setting via script
  useEffect(() => {
    // This runs once on mount to apply stored settings immediately
    const stored = localStorage.getItem('spitr-ui-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.state?.theme) {
          document.body.setAttribute('data-theme', parsed.state.theme)
        }
        if (typeof parsed.state?.scanlines === 'boolean') {
          document.body.setAttribute('data-scanlines', parsed.state.scanlines.toString())
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  return <>{children}</>
}
