import { useCountdown } from '@/hooks/useCountdown'

// Countdown to a server timestamp; 0 when there is none.
export const useSecondsLeft = (untilMs: number): number =>
  useCountdown(untilMs > 0 ? untilMs : null)
