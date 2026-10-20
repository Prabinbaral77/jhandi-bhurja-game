import { createAccessTokens } from '@jhandi/auth/accessToken'
import { env } from '#lib/env'

export const accessTokens = createAccessTokens(env.AUTH_SECRET, env.ACCESS_TOKEN_TTL_SEC)
