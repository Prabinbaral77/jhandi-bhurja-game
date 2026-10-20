import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Local dev reads the repo-root .env; CI and production pass real env vars.
export const loadRootEnv = (): void => {
  const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)
}
