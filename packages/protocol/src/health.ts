import { z } from 'zod'

// `disabled` = optional dependency not configured in this environment.
export const dependencyStatusSchema = z.enum(['up', 'down', 'disabled'])

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>

export const healthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), dependencyStatusSchema),
  // Process facts for operators: a small uptime means the host restarted (deploy, crash, sleep).
  uptimeSec: z.number().optional(),
  memoryMb: z.number().optional(),
  rooms: z.number().optional(),
  connections: z.number().optional(),
})

export type Health = z.infer<typeof healthSchema>
