import {
  claimDailyBonusOutputSchema,
  pageInputSchema,
  walletOutputSchema,
  walletTransactionsOutputSchema,
} from '@jhandi/protocol/wallet'
import { protectedProcedure, router } from '#lib/trpc'
import { claimDailyBonus, getWallet, listWalletTransactions } from '#services/walletService'

export const walletRouter = router({
  get: protectedProcedure.output(walletOutputSchema).query(({ ctx }) => getWallet(ctx.userId)),
  transactions: protectedProcedure
    .input(pageInputSchema)
    .output(walletTransactionsOutputSchema)
    .query(({ ctx, input }) => listWalletTransactions(ctx.userId, input)),
  claimDailyBonus: protectedProcedure
    .output(claimDailyBonusOutputSchema)
    .mutation(({ ctx }) => claimDailyBonus(ctx.userId)),
})
