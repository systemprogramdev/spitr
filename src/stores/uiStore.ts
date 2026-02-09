import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: string
  scanlines: boolean
  soundEnabled: boolean
  notificationsEnabled: boolean
  setTheme: (theme: string) => void
  toggleScanlines: () => void
  toggleSound: () => void
  setNotificationsEnabled: (enabled: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'terminal',
      scanlines: true,
      soundEnabled: true,
      notificationsEnabled: false,
      setTheme: (theme) => set({ theme }),
      toggleScanlines: () => set((state) => ({ scanlines: !state.scanlines })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
    }),
    {
      name: 'spitr-ui-settings',
    }
  )
)
