import type { GameSymbol } from '@jhandi/game-rules/symbols'

// Cube faces are laid out in SYMBOLS order (components/art/Cube.tsx). Rotating the cube by
// these angles brings the wanted symbol to the front.
export const FACE_UP_ROTATION: Record<GameSymbol, { rx: number; ry: number }> = {
  CROWN: { rx: 0, ry: 0 },
  FLAG: { rx: 0, ry: 180 },
  HEART: { rx: 0, ry: -90 },
  SPADE: { rx: 0, ry: 90 },
  DIAMOND: { rx: -90, ry: 0 },
  CLUB: { rx: 90, ry: 0 },
}

export interface Landing {
  x: number // % of arena width
  y: number // % of arena height
  spin: number // extra full turns while tumbling
  tilt: number // final resting yaw, degrees
  delay: number // ms after the throw starts
  arcX: number // px sideways drift during the first bounce
}

// Deterministic per round, so every re-render (and every client) sees the same throw.
export const landingsFor = (seed: string): Landing[] => {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const slots = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5)
  return slots.map((slot) => ({
    x: 16 + (slot % 3) * 34 + (rand() - 0.5) * 14,
    y: 32 + Math.floor(slot / 3) * 42 + (rand() - 0.5) * 16,
    spin: 2 + Math.floor(rand() * 2),
    tilt: (rand() - 0.5) * 50,
    delay: Math.floor(rand() * 260),
    arcX: (rand() - 0.5) * 80,
  }))
}
