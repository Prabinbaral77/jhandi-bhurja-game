import { z } from 'zod'

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url(),
    DATABASE_URL: z.url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
    // Optional until lobby/presence (M4) and rate limits need it.
    REDIS_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    // Signs access tokens and peppers OTP / refresh-token hashes. Generate with `openssl rand -hex 32`.
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    // `console` = no SMS is sent; the code is returned to the web app (development only).
    SMS_PROVIDER: z.enum(['console']).default('console'),
    // Per-IP abuse limits for sign-in. Raised only for load/e2e tests.
    OTP_IP_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(10),
    OTP_IP_VERIFIES_PER_15MIN: z.coerce.number().int().positive().default(30),
    GOOGLE_CLIENT_ID: optionalString,
  })
  // Only the console sender exists so far; production must wait for a real SMS provider.
  .refine((env) => env.NODE_ENV !== 'production', {
    message: 'SMS_PROVIDER=console is not allowed in production; add a real SMS provider first',
    path: ['SMS_PROVIDER'],
  })

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env: Env = parsed.data
