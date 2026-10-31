import type { DbOrTx } from '@jhandi/db/database'
import { auditLog } from '@jhandi/db/schema/audit'
import { users } from '@jhandi/db/schema/users'
import { desc, eq, lt } from 'drizzle-orm'
import { db } from '#lib/db'

export interface AuditInput {
  actorId: string | null
  action: string
  target?: string
  data?: Record<string, unknown>
}

// Append-only. Pass the admin action's own transaction so the entry lands with the change.
export const writeAudit = async (conn: DbOrTx, input: AuditInput): Promise<void> => {
  await conn.insert(auditLog).values({
    actorId: input.actorId,
    action: input.action,
    target: input.target ?? null,
    data: input.data ?? null,
  })
}

export const listAudit = async (limit: number, beforeId?: number) =>
  db
    .select({
      id: auditLog.id,
      actorId: auditLog.actorId,
      actorName: users.displayName,
      action: auditLog.action,
      target: auditLog.target,
      data: auditLog.data,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(beforeId === undefined ? undefined : lt(auditLog.id, beforeId))
    .orderBy(desc(auditLog.id))
    .limit(limit)
