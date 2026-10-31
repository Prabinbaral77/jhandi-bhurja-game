import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const envDir = fileURLToPath(new URL('../..', import.meta.url))

// Fills %CSP_CONNECT_SRC% in index.html: the API, and the game server over BOTH ws(s) and
// http(s) — Colyseus matchmakes over HTTP before upgrading to a WebSocket (docs/security.md).
const cspConnectSrc = (mode: string): Plugin => {
  const env = loadEnv(mode, envDir, 'VITE_')
  const api = env.VITE_API_URL ?? ''
  const ws = env.VITE_GAME_SERVER_URL ?? ''
  const http = ws.replace(/^ws(s?):/, 'http$1:')
  const sources = [...new Set([api, ws, http].filter(Boolean))].join(' ')
  return {
    name: 'jhandi-csp-connect-src',
    transformIndexHtml: (html) => html.replaceAll('%CSP_CONNECT_SRC%', sources),
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), cspConnectSrc(mode)],
  envDir,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
}))
