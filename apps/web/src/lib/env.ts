import { z } from 'zod'

const envSchema = z.object({
  VITE_API_URL: z.url(),
  VITE_GAME_SERVER_URL: z.url(),
  VITE_GOOGLE_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
})

export const env = envSchema.parse(import.meta.env)
