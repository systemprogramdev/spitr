'use client'

import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

export type SoundName = 'knife' | 'gold' | 'drone' | 'spit' | 'gunshot' | 'chest' | 'potion'

const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {}

export function useSound() {
  const soundEnabled = useUIStore((s) => s.soundEnabled)

  const playSound = useCallback(
    (name: SoundName) => {
      if (!soundEnabled || typeof window === 'undefined') return

      try {
        // Reuse cached audio elements, reset to beginning
        let audio = audioCache[name]
        if (!audio) {
          audio = new Audio(`/sounds/${name}.mp3`)
          audio.volume = 0.5
          audioCache[name] = audio
        }
        audio.currentTime = 0
        audio.play().catch(() => {})
      } catch {
        // Silently fail — sound is non-critical
      }
    },
    [soundEnabled]
  )

  return { playSound }
}
