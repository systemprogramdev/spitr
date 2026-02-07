'use client'

import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

export type SoundName = 'knife' | 'gold' | 'drone' | 'spit' | 'gunshot' | 'chest' | 'potion' | 'nuke' | 'levelup' | 'shield' | 'block' | 'spraypaint' | 'notification' | 'send' | 'destroy' | 'paper' | 'winning' | 'losing'

const audioCache: Partial<Record<SoundName, HTMLAudioElement>> = {}

// Standalone function — works outside React lifecycle, reads sound setting directly from store
export function playSoundDirect(name: SoundName) {
  if (typeof window === 'undefined') return
  const soundEnabled = useUIStore.getState().soundEnabled
  if (!soundEnabled) return

  try {
    let audio = audioCache[name]
    if (!audio) {
      audio = new Audio(`/sounds/${name}.mp3`)
      audio.volume = 0.5
      audioCache[name] = audio
    }
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // Silently fail
  }
}

export function useSound() {
  const soundEnabled = useUIStore((s) => s.soundEnabled)

  const playSound = useCallback(
    (name: SoundName) => {
      if (!soundEnabled || typeof window === 'undefined') return

      try {
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
