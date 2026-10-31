import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { AppError } from '@jhandi/protocol/appError'
import type { AppErrorShape, ErrorCode } from '@jhandi/protocol/errors'
import { randomUUID } from 'node:crypto'
import { ZodError, z } from 'zod'
import { findUserById } from '#repositories/userRepository'
import { verifyAccessToken } from '#services/tokenService'

export const createContext = ({ req, res }: CreateExpressContextOptions) => ({
  requestId: req.header('x-request-id') ?? randomUUID(),
  ip: req.ip ?? 'unknown',
  req,
  res,
})

export type Context = Awaited<ReturnType<typeof createContext>>

// tRPC's own errors (unknown route, bad JSON …) mapped to our codes.
const trpcCodeMap: Partial<Record<TRPCError['code'], ErrorCode>> = {
  BAD_REQUEST: 'VALIDATION_FAILED',
  PARSE_ERROR: 'VALIDATION_FAILED',
  UNSUPPORTED_MEDIA_TYPE: 'VALIDATION_FAILED',
  METHOD_NOT_SUPPORTED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  TOO_MANY_REQUESTS: 'RATE_LIMITED',
}

// Our codes mapped to tRPC codes, which decide the HTTP status.
const appToTrpcCode: Partial<Record<ErrorCode, TRPCError['code']>> = {
  UNAUTHENTICATED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'TOO_MANY_REQUESTS',
  ALREADY_CLAIMED: 'CONFLICT',
  ALREADY_HOSTING: 'CONFLICT',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
}

const INTERNAL_ERROR: AppErrorShape = { code: 'INTERNAL', message: 'Something went wrong' }

// Every error leaves the API in the shared shape (docs/api-protocol.md §1.1).
const toAppErrorShape = (error: TRPCError): AppErrorShape => {
  const { cause } = error
  if (cause instanceof AppError) return cause.toShape()
  if (cause instanceof ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: 'Invalid input',
      details: { issues: z.treeifyError(cause) },
    }
  }
  const code = trpcCodeMap[error.code]
  return code ? { code, message: error.message } : INTERNAL_ERROR
}

const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => {
    const appError = toAppErrorShape(error)
    return {
      ...shape,
      // Internal error messages can leak details, so clients only see the generic text.
      message: appError.code === 'INTERNAL' ? INTERNAL_ERROR.message : appError.message,
      data: { ...shape.data, stack: undefined, appError },
    }
  },
})

// Services throw AppError; give it the right HTTP status instead of a generic 500.
const appErrorStatus = t.middleware(async ({ next }) => {
  const result = await next()
  if (!result.ok && result.error.cause instanceof AppError) {
    const cause = result.error.cause
    throw new TRPCError({
      code: appToTrpcCode[cause.code] ?? 'BAD_REQUEST',
      message: cause.message,
      cause,
    })
  }
  return result
})

const BEARER = /^Bearer (.+)$/

// Stateless check (signature + expiry). Account status is re-checked on refresh and on
// coin-moving actions, so a frozen user loses access within one access-token lifetime.
const requireUser = t.middleware(async ({ ctx, next }) => {
  const token = BEARER.exec(ctx.req.header('authorization') ?? '')?.[1]
  if (!token) throw new AppError('UNAUTHENTICATED', 'Please sign in')
  const userId = await verifyAccessToken(token)
  return next({ ctx: { ...ctx, userId } })
})

// Admin checks hit the DB every time: a revoked admin must lose access immediately.
const requireAdmin = t.middleware(async ({ ctx, next }) => {
  const userId = (ctx as { userId?: string }).userId
  const user = userId ? await findUserById(userId) : undefined
  if (!user?.isAdmin || user.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'Admins only')
  return next()
})

export const router = t.router
export const publicProcedure = t.procedure.use(appErrorStatus)
export const protectedProcedure = publicProcedure.use(requireUser)
export const adminProcedure = protectedProcedure.use(requireAdmin)
