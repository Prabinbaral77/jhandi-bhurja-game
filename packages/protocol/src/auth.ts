import { z } from 'zod'
import { userSchema } from '#user'

// Nepal mobile numbers: 98XXXXXXXX / 97XXXXXXXX, with or without +977.
export const NEPAL_PHONE_PATTERN = /^(?:\+?977[- ]?)?(9[78]\d{8})$/

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => NEPAL_PHONE_PATTERN.test(value), 'Enter a valid Nepali mobile number')
  .transform((value) => `+977${NEPAL_PHONE_PATTERN.exec(value)?.[1] ?? ''}`)

export const requestOtpInputSchema = z.object({ phone: phoneSchema })

export const requestOtpOutputSchema = z.object({
  expiresInSec: z.number(),
  resendAfterSec: z.number(),
  // Only in local development with the console SMS sender, so the code can be typed in.
  devCode: z.string().optional(),
})

export const verifyOtpInputSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Code is 6 digits'),
})

export const googleSignInInputSchema = z.object({ idToken: z.string().min(1) })

export const signInOutputSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.number(),
  user: userSchema,
  isNewUser: z.boolean(),
  signupBonus: z.number(),
})

export type SignInOutput = z.infer<typeof signInOutputSchema>

export const refreshOutputSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.number(),
  user: userSchema,
})

export const authConfigOutputSchema = z.object({
  googleEnabled: z.boolean(),
})
