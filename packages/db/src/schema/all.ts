import * as bonuses from '#schema/bonuses'
import * as invites from '#schema/invites'
import * as ledger from '#schema/ledger'
import * as platformSettings from '#schema/platformSettings'
import * as rooms from '#schema/rooms'
import * as users from '#schema/users'

// Full schema object for drizzle clients (postgres-js in apps, PGlite in tests).
export const schema = { ...users, ...ledger, ...bonuses, ...platformSettings, ...rooms, ...invites }
