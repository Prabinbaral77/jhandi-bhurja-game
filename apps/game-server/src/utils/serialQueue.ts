// Runs async jobs one at a time, in order. A room's coin-moving work goes through this so two
// bets can't both pass the bank exposure check before either is recorded.
export const createSerialQueue = () => {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(job)
    tail = result.catch(() => undefined)
    return result
  }
}
