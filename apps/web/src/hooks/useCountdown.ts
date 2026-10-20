import { useEffect, useState } from 'react'

// Seconds left until `untilMs`, ticking once a second.
export const useCountdown = (untilMs: number | null): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (untilMs === null) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1_000)
    return () => {
      clearInterval(timer)
    }
  }, [untilMs])
  return untilMs === null ? 0 : Math.max(0, Math.ceil((untilMs - now) / 1_000))
}
