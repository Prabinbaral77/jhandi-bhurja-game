// docs/art-direction.md §2
export const palette = {
  brick: '#A63D2A',
  tika: '#D7262E',
  brass: '#C9A23A',
  wood: '#3B2418',
  jamara: '#7BAA3B',
  cream: '#F3E6C8',
  marigold: '#F2A51A',
} as const

export type PaletteColor = keyof typeof palette
