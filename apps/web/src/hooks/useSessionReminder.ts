import { useEffect, useState } from 'react'

const REMIND_EVERY_MS = 60 * 60 * 1000

// Responsible play: once an hour, remind a signed-in player how long they've been here.
export const useSessionReminder = (enabled: boolean): { hours: number; dismiss: () => void } => {
  const [hours, setHours] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const startedAt = Date.now()
    const timer = setInterval(() => {
      setHours(Math.floor((Date.now() - startedAt) / REMIND_EVERY_MS))
    }, 60_000)
    return () => {
      clearInterval(timer)
    }
  }, [enabled])
  return {
    hours,
    dismiss: () => {
      setHours(0)
    },
  }
}
