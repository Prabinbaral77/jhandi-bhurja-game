import { pino } from 'pino'
import { env } from '#lib/env'

export const logger = pino({ name: 'game-server', level: env.LOG_LEVEL })
