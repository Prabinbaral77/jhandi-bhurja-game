import { z } from 'zod'

// `disabled` = optional dependency not configured in this environment.
export const dependencyStatusSchema = z.enum(['up', 'down', 'disabled'])

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>

export const healthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), dependencyStatusSchema),
})

export type Health = z.infer<typeof healthSchema>
