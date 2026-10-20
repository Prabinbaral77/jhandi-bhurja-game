import type { GameSymbol } from '@jhandi/game-rules/symbols'

// Placeholder glyphs until the heritage artwork lands in M6 (docs/art-direction.md).
export const SYMBOL_GLYPH: Record<GameSymbol, string> = {
  CROWN: '👑',
  FLAG: '🚩',
  HEART: '♥',
  SPADE: '♠',
  DIAMOND: '♦',
  CLUB: '♣',
}

export const SYMBOL_COLOR: Record<GameSymbol, string> = {
  CROWN: 'text-brass',
  FLAG: 'text-tika',
  HEART: 'text-tika',
  SPADE: 'text-cream',
  DIAMOND: 'text-tika',
  CLUB: 'text-cream',
}
