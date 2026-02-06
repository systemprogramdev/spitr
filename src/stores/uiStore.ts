import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: string
  scanlines: boolean
  soundEnabled: boolean
  setTheme: (theme: string) => void
  toggleScanlines: () => void
  toggleSound: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'terminal',
      scanlines: true,
      soundEnabled: true,
      setTheme: (theme) => set({ theme }),
      toggleScanlines: () => set((state) => ({ scanlines: !state.scanlines })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
    }),
    {
      name: 'spitr-ui-settings',
    }
  )
)
