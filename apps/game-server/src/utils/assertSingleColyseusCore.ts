import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Colyseus keeps its room registry in a module-level map inside @colyseus/core. Its packages
 * have circular peer dependencies, and pnpm can end up giving the WebSocket transport a
 * different copy of core than the one we create rooms with. Every join then fails with
 * "seat reservation expired". Fail fast at startup instead.
 */
export const assertSingleColyseusCore = (): void => {
  const require = createRequire(import.meta.url)
  const ours = realpathSync(require.resolve('@colyseus/core'))
  const transportRequire = createRequire(require.resolve('@colyseus/ws-transport'))
  const transports = realpathSync(transportRequire.resolve('@colyseus/core'))
  if (ours !== transports) {
    throw new Error(
      `Two copies of @colyseus/core are installed:\n  ${ours}\n  ${transports}\n` +
        'Make sure apps/game-server depends on @colyseus/core and @colyseus/ws-transport directly.',
    )
  }
}
