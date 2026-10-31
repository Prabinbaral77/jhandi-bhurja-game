import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean().default(false),
})

export type PublicUser = z.infer<typeof userSchema>

export const updateMeInputSchema = z.object({
  displayName: z.string().trim().min(2).max(30).optional(),
})
