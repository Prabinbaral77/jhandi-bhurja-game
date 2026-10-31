import { z } from 'zod'

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
)

const PLACEHOLDER_SECRET = /change-me|example|secret-test/i

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
    // Global per-IP request budget (docs/security.md).
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
    // Per-IP budget for sign-in / refresh / invite-code paths. Raised only for load/e2e tests.
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
    // Number of reverse proxies in front of the API (so req.ip is the real client). 0 = none.
    TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),
    GOOGLE_CLIENT_ID: optionalString,
    // Comma-separated Google e-mails that get admin access on sign-in; everyone else loses it.
    // Empty = admin flags are managed only by the admin:grant / admin:revoke scripts.
    ADMIN_EMAILS: z.preprocess(
      (value) =>
        typeof value === 'string'
          ? value
              .split(',')
              .map((part) => part.trim().toLowerCase())
              .filter(Boolean)
          : [],
      z.array(z.email()),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return
    // Production guard rails: refuse to start with development-only settings.
    if (!env.WEB_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'must be https:// in production',
      })
    }
    if (PLACEHOLDER_SECRET.test(env.AUTH_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_SECRET'], message: 'looks like a placeholder' })
    }
    if (!env.GOOGLE_CLIENT_ID) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message:
          'no real sign-in method: SMS_PROVIDER=console is not allowed in production and GOOGLE_CLIENT_ID is empty',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error))
  process.exit(1)
}

export const env: Env = parsed.data
