import { Client } from '@colyseus/sdk'
import { env } from '@/lib/env'

export const gameClient = new Client(env.VITE_GAME_SERVER_URL)
