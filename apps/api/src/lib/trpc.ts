import { initTRPC, type TRPCError } from '@trpc/server'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import { AppError } from '@jhandi/protocol/appError'
import type { AppErrorShape, ErrorCode } from '@jhandi/protocol/errors'
import { randomUUID } from 'node:crypto'
import { ZodError, z } from 'zod'

export const createContext = ({ req }: CreateExpressContextOptions) => ({
  requestId: req.header('x-request-id') ?? randomUUID(),
})

export type Context = Awaited<ReturnType<typeof createContext>>

// tRPC's own errors (unknown route, bad JSON …) mapped to our codes.
const trpcCodeMap: Partial<Record<TRPCError['code'], ErrorCode>> = {
  BAD_REQUEST: 'VALIDATION_FAILED',
  PARSE_ERROR: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  TOO_MANY_REQUESTS: 'RATE_LIMITED',
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
      message: appError.code === 'INTERNAL' ? INTERNAL_ERROR.message : shape.message,
      data: { ...shape.data, stack: undefined, appError },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
