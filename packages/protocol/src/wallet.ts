import { z } from 'zod'

export const walletOutputSchema = z.object({
  balance: z.number(),
  dailyBonusAmount: z.number(),
  dailyBonusAvailable: z.boolean(),
  // Epoch ms of the next Kathmandu midnight when today's bonus is already claimed.
  nextDailyBonusAt: z.number().nullable(),
})

export type Wallet = z.infer<typeof walletOutputSchema>

export const WALLET_TX_KINDS = [
  'SIGNUP_BONUS',
  'DAILY_BONUS',
  'HOST_DEPOSIT',
  'BANK_TOPUP',
  'BET',
  'BET_CANCEL',
  'SETTLE',
  'PLATFORM_FEE',
  'ROOM_CLOSE',
  'ADJUSTMENT',
] as const

export const walletTxSchema = z.object({
  id: z.string(),
  kind: z.enum(WALLET_TX_KINDS),
  amount: z.number(),
  createdAt: z.number(),
})

export type WalletTx = z.infer<typeof walletTxSchema>

export const pageInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const walletTransactionsOutputSchema = z.object({
  items: z.array(walletTxSchema),
  nextCursor: z.string().nullable(),
})

export const claimDailyBonusOutputSchema = z.object({
  amount: z.number(),
  balance: z.number(),
})
