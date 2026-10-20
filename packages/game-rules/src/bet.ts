import { z } from 'zod'
import { symbolSchema } from '#symbols'

export const betSchema = z.object({
  betId: z.string().min(1),
  userId: z.string().min(1),
  symbol: symbolSchema,
  amount: z.number().int().positive(),
})

export type Bet = z.infer<typeof betSchema>
