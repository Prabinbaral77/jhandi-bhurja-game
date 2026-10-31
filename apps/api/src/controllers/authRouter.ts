import { AppError } from '@jhandi/protocol/appError'
import {
  authConfigOutputSchema,
  googleSignInInputSchema,
  refreshOutputSchema,
  requestOtpInputSchema,
  requestOtpOutputSchema,
  signInOutputSchema,
  verifyOtpInputSchema,
  type SignInOutput,
} from '@jhandi/protocol/auth'
import { z } from 'zod'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '#lib/authCookie'
import { publicProcedure, router, type Context } from '#lib/trpc'
import {
  isGoogleEnabled,
  requestOtp,
  signInWithGoogle,
  verifyOtp,
  type SignInResult,
} from '#services/authService'
import {
  consumeRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  revokeRefreshTokenIfValid,
} from '#services/tokenService'
import { findUserById } from '#repositories/userRepository'
import { getMe, toPublicUser } from '#services/userService'

const startSession = async (ctx: Context, result: SignInResult): Promise<SignInOutput> => {
  const [access, refresh] = await Promise.all([
    issueAccessToken(result.user.id),
    issueRefreshToken(result.user.id),
  ])
  setRefreshCookie(ctx.res, refresh.token, refresh.maxAgeMs)
  return {
    ...access,
    user: toPublicUser(result.user),
    isNewUser: result.isNewUser,
    signupBonus: result.signupBonus,
  }
}

export const authRouter = router({
  config: publicProcedure
    .output(authConfigOutputSchema)
    .query(() => ({ googleEnabled: isGoogleEnabled() })),

  requestOtp: publicProcedure
    .input(requestOtpInputSchema)
    .output(requestOtpOutputSchema)
    .mutation(({ input, ctx }) => requestOtp(input.phone, ctx.ip)),

  verifyOtp: publicProcedure
    .input(verifyOtpInputSchema)
    .output(signInOutputSchema)
    .mutation(async ({ input, ctx }) =>
      startSession(ctx, await verifyOtp(input.phone, input.code, ctx.ip)),
    ),

  google: publicProcedure
    .input(googleSignInInputSchema)
    .output(signInOutputSchema)
    .mutation(async ({ input, ctx }) =>
      startSession(ctx, await signInWithGoogle(input.idToken, ctx.ip)),
    ),

  refresh: publicProcedure.output(refreshOutputSchema).mutation(async ({ ctx }) => {
    const token = readRefreshCookie(ctx.req)
    if (!token) throw new AppError('UNAUTHENTICATED', 'Please sign in')
    try {
      const userId = await consumeRefreshToken(token)
      const account = await findUserById(userId)
      if (account?.status !== 'ACTIVE')
        throw new AppError('FORBIDDEN', 'This account is not active')
      const user = await getMe(userId)
      const [access, refresh] = await Promise.all([
        issueAccessToken(userId),
        issueRefreshToken(userId),
      ])
      setRefreshCookie(ctx.res, refresh.token, refresh.maxAgeMs)
      return { ...access, user }
    } catch (error) {
      clearRefreshCookie(ctx.res)
      throw error
    }
  }),

  logout: publicProcedure.output(z.object({ ok: z.literal(true) })).mutation(async ({ ctx }) => {
    const token = readRefreshCookie(ctx.req)
    if (token) await revokeRefreshTokenIfValid(token)
    clearRefreshCookie(ctx.res)
    return { ok: true as const }
  }),
})
