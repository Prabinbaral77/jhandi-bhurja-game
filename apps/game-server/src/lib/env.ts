import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GAME_SERVER_PORT: z.coerce.number().int().positive().default(2567),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
  // Same secret as the API: the game server verifies the API's access tokens.
  AUTH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
  // The web app's origin: the only site allowed to matchmake / open sockets.
  // An origin has no path: a trailing slash pasted into a dashboard must not break CORS.
  WEB_ORIGIN: z.url().transform((value) => value.replace(/\/+$/, '')),
  // Number of reverse proxies in front of the server (real client IP for rate limits).
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
  // Per-IP matchmaking budget (seat reservations). Raised only for load tests from one machine.
  MATCHMAKE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  // Shared room registry + pub/sub across several game-server nodes. Optional on one node.
  REDIS_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
  // Also serve the API (`/v1/trpc`) from this process: one host, one port (docs/deploy.md §0c).
  SERVE_API: z.preprocess((value) => value === 'true' || value === '1', z.boolean()).default(false),
})

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env: Env = parsed.data
