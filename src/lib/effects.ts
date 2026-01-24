// Spit effects from sysui-css
// Each effect costs +1 spit to use

export interface SpitEffect {
  id: string
  name: string
  description: string
  className: string
  preview: string // CSS for preview
}

export const SPIT_EFFECTS: SpitEffect[] = [
  {
    id: 'glitch',
    name: 'GLITCH',
    description: 'Cyberpunk glitch distortion',
    className: 'spit-effect-glitch',
    preview: 'Glitchy chromatic aberration',
  },
  {
    id: 'glow-pulse',
    name: 'PULSE',
    description: 'Pulsing neon glow',
    className: 'spit-effect-pulse',
    preview: 'Breathing neon glow',
  },
  {
    id: 'flicker',
    name: 'FLICKER',
    description: 'Flickering terminal text',
    className: 'spit-effect-flicker',
    preview: 'Old CRT flicker',
  },
  {
    id: 'electric',
    name: 'ELECTRIC',
    description: 'Electric border animation',
    className: 'spit-effect-electric',
    preview: 'Electric border glow',
  },
  {
    id: 'matrix',
    name: 'MATRIX',
    description: 'Matrix code style',
    className: 'spit-effect-matrix',
    preview: 'Green matrix text',
  },
  {
    id: 'hologram',
    name: 'HOLO',
    description: 'Holographic gradient',
    className: 'spit-effect-hologram',
    preview: 'Rainbow hologram shift',
  },
]

export const EFFECT_COST = 1 // Extra spits for using an effect

export function getEffectById(id: string | null): SpitEffect | null {
  if (!id) return null
  return SPIT_EFFECTS.find((e) => e.id === id) || null
}

export function getEffectClassName(id: string | null): string {
  const effect = getEffectById(id)
  return effect?.className || ''
}
