import { DICE_COUNT, SYMBOLS, type GameSymbol } from '#symbols'

export type SymbolCounts = Record<GameSymbol, number>

export const emptyCounts = (): SymbolCounts => ({
  CROWN: 0,
  FLAG: 0,
  HEART: 0,
  SPADE: 0,
  DIAMOND: 0,
  CLUB: 0,
})

export const countSymbols = (dice: readonly GameSymbol[]): SymbolCounts => {
  if (dice.length !== DICE_COUNT) {
    throw new RangeError(`Expected ${DICE_COUNT} dice, got ${dice.length}`)
  }
  const counts = emptyCounts()
  for (const symbol of dice) counts[symbol] += 1
  return counts
}

// Every way 6 dice can land as per-symbol counts (order of dice ignored): C(11,5) = 462.
// Built symbol by symbol; the last symbol takes whatever dice are left.
const buildOutcomes = (): readonly SymbolCounts[] => {
  let partials = [{ counts: emptyCounts(), remaining: DICE_COUNT }]
  SYMBOLS.forEach((symbol, index) => {
    const isLast = index === SYMBOLS.length - 1
    partials = partials.flatMap(({ counts, remaining }) => {
      const choices = isLast ? [remaining] : Array.from({ length: remaining + 1 }, (_, n) => n)
      return choices.map((n) => ({ counts: { ...counts, [symbol]: n }, remaining: remaining - n }))
    })
  })
  return Object.freeze(partials.map(({ counts }) => counts))
}

export const ALL_OUTCOMES: readonly SymbolCounts[] = buildOutcomes()

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

// Probability of a counts vector with fair dice: 6! / (c1!·…·c6!) / 6^6.
export const outcomeProbability = (counts: SymbolCounts): number => {
  const arrangements = SYMBOLS.reduce(
    (acc, symbol) => acc / factorial(counts[symbol]),
    factorial(DICE_COUNT),
  )
  return arrangements / SYMBOLS.length ** DICE_COUNT
}
