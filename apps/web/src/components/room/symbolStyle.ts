import type { GameSymbol } from '@jhandi/game-rules/symbols'

// Text-only fallback for places that can't render SVG (share text, aria labels).
export const SYMBOL_GLYPH: Record<GameSymbol, string> = {
  CROWN: '♛',
  FLAG: '⚑',
  HEART: '♥',
  SPADE: '♠',
  DIAMOND: '♦',
  CLUB: '♣',
}
