// TODO(tech-debt): per-process memory only, so limits reset on restart and aren't shared across
// API instances. Move to Redis when it arrives in M4 (docs/progress.md tech debt).
export const createRateLimiter = ({ limit, windowMs }: { limit: number; windowMs: number }) => {
  const hits = new Map<string, { count: number; resetAt: number }>()

  return {
    // Returns ms to wait when over the limit, otherwise 0.
    hit(key: string, now = Date.now()): number {
      const entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        if (hits.size > 10_000) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
        }
        return 0
      }
      entry.count += 1
      return entry.count > limit ? entry.resetAt - now : 0
    },
  }
}
