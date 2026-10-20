import { v7 } from 'uuid'

// Time-ordered UUIDs (v7) keep B-tree inserts cheap; generated in the app (Postgres 17 has no uuidv7()).
export const newId = (): string => v7()
