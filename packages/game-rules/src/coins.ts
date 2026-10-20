// Coins are whole numbers. Every public function that takes an amount checks it here.
export const assertCoinAmount = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer, got ${value}`)
  }
}
