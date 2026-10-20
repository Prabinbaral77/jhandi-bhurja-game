import { defineConfig } from 'drizzle-kit'
import { loadRootEnv } from './src/env.ts'

loadRootEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema',
  out: './migrations',
  schemaFilter: ['jhandi'],
  dbCredentials: { url: databaseUrl },
  strict: true,
})
