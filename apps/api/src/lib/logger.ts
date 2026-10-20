import { pino } from 'pino'
import { env } from '#lib/env'

export const logger = pino({ name: 'api', level: env.LOG_LEVEL })
