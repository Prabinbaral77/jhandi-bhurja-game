import {
  adminAdjustCoinsInputSchema,
  adminLedgerEntrySchema,
  adminLedgerInputSchema,
  adminRoomSchema,
  adminSearchUsersInputSchema,
  adminSetStatusInputSchema,
  adminSettingsSchema,
  adminUpdateSettingInputSchema,
  adminUserSchema,
  auditEntrySchema,
  collusionFlagSchema,
} from '@jhandi/protocol/admin'
import { pageInputSchema } from '@jhandi/protocol/wallet'
import { z } from 'zod'
import { adminProcedure, router } from '#lib/trpc'
import {
  adminAdjustCoins,
  adminAudit,
  adminCollusion,
  adminGetSettings,
  adminGetUser,
  adminListRooms,
  adminSearchUsers,
  adminSetUserStatus,
  adminUpdateSetting,
  adminUserLedger,
} from '#services/adminService'

const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() })

export const adminRouter = router({
  searchUsers: adminProcedure
    .input(adminSearchUsersInputSchema)
    .output(z.array(adminUserSchema))
    .query(({ input }) => adminSearchUsers(input.query)),
  getUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .output(adminUserSchema)
    .query(({ input }) => adminGetUser(input.userId)),
  setUserStatus: adminProcedure
    .input(adminSetStatusInputSchema)
    .output(adminUserSchema)
    .mutation(({ ctx, input }) => adminSetUserStatus(ctx.userId, input)),
  adjustCoins: adminProcedure
    .input(adminAdjustCoinsInputSchema)
    .output(adminUserSchema)
    .mutation(({ ctx, input }) => adminAdjustCoins(ctx.userId, input)),
  userLedger: adminProcedure
    .input(adminLedgerInputSchema)
    .output(page(adminLedgerEntrySchema))
    .query(({ input }) => adminUserLedger(input.userId, input)),
  rooms: adminProcedure.output(z.array(adminRoomSchema)).query(() => adminListRooms()),
  settings: adminProcedure.output(adminSettingsSchema).query(() => adminGetSettings()),
  updateSetting: adminProcedure
    .input(adminUpdateSettingInputSchema)
    .output(adminSettingsSchema)
    .mutation(({ ctx, input }) => adminUpdateSetting(ctx.userId, input)),
  audit: adminProcedure
    .input(pageInputSchema)
    .output(page(auditEntrySchema))
    .query(({ input }) => adminAudit(input)),
  collusion: adminProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(90).default(7),
        minNetWon: z.number().int().min(0).default(3_000),
      }),
    )
    .output(z.array(collusionFlagSchema))
    .query(({ input }) => adminCollusion(input.days, input.minNetWon)),
})
