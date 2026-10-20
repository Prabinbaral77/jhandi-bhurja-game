import { appErrorShapeSchema } from '@jhandi/protocol/errors'
import { TRPCClientError } from '@trpc/client'
import { isMessageKey, type MessageKey } from '@/lib/i18n'

// Maps any API error to a translated message key (docs/api-protocol.md §1.1).
export const errorMessageKey = (error: unknown): MessageKey => {
  if (error instanceof TRPCClientError) {
    const data: unknown = error.data
    const parsed = appErrorShapeSchema.safeParse(
      typeof data === 'object' && data !== null && 'appError' in data ? data.appError : undefined,
    )
    if (parsed.success) {
      const key = `error.${parsed.data.code}`
      if (isMessageKey(key)) return key
    }
  }
  return 'error.generic'
}
