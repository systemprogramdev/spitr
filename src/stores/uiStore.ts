import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: string
  scanlines: boolean
  setTheme: (theme: string) => void
  toggleScanlines: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'terminal',
      scanlines: true,
      setTheme: (theme) => set({ theme }),
      toggleScanlines: () => set((state) => ({ scanlines: !state.scanlines })),
    }),
    {
      name: 'spitr-ui-settings',
    }
  )
)
