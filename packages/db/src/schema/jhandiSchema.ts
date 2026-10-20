import { pgSchema } from 'drizzle-orm/pg-core'

// All tables live in their own schema, not `public`: Supabase's Data API exposes `public`
// to anyone with the project's anon key. The game talks to Postgres directly, never via that API.
export const jhandiSchema = pgSchema('jhandi')
