import { sql } from '#lib/db'

/**
 * Wipes every player, room, round, bet, ledger row, session and audit entry — keeps the schema,
 * platform settings and the three system accounts (reset to 0). For a fresh launch after
 * testing. Irreversible. Refuses to run without --yes, and in production without --production.
 *
 *   pnpm --filter @jhandi/api db:reset -- --yes
 */
const args = process.argv.slice(2)
if (!args.includes('--yes')) {
  console.error('refusing: pass --yes to wipe all game data')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production' && !args.includes('--production')) {
  console.error('refusing: NODE_ENV=production needs --production as well')
  process.exit(1)
}

// Every table in the jhandi schema except the settings; the system accounts are re-seeded.
const KEEP = new Set(['platform_settings'])
const toWipe = (
  await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'jhandi' and table_type = 'BASE TABLE' order by table_name`
)
  .map((r) => r.table_name)
  .filter((t) => !KEEP.has(t))

const before: Record<string, number> = {}
for (const t of toWipe) {
  const [row] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from "jhandi"."${t}"`)
  before[t] = row?.n ?? 0
}
console.table(before)

// platform_settings references users (updated_by), so TRUNCATE … CASCADE empties it too:
// snapshot the values and put them back (with the migration defaults as a fallback).
const DEFAULT_SETTINGS: Record<string, string> = {
  SIGNUP_BONUS: '5000',
  DAILY_BONUS: '10',
  MIN_HOST_DEPOSIT: '5000',
  MIN_HOST_BANK_TO_CONTINUE: '1000',
  PLATFORM_FEE_BPS: '200',
  PRIVATE_ROOM_MAX_MEMBERS: '20',
  DAILY_LOSS_CAP: '3000',
}
// `value` is numeric in Postgres and comes back as a number.
const saved = await sql<
  { key: string; value: string | number }[]
>`select key, value from jhandi.platform_settings`
const settings = {
  ...DEFAULT_SETTINGS,
  ...Object.fromEntries(saved.map((r) => [r.key, String(r.value)])),
}

await sql.begin(async (tx) => {
  await tx.unsafe(
    `truncate table ${toWipe.map((t) => `"jhandi"."${t}"`).join(', ')} restart identity cascade`,
  )
  // Same rows as migration 0002: fixed ids the ledger code relies on.
  await tx.unsafe(`insert into "jhandi"."accounts" ("id", "type", "owner_id", "code", "balance") values
    ('00000000-0000-7000-8000-000000000001', 'SYSTEM', null, 'BONUS', 0),
    ('00000000-0000-7000-8000-000000000002', 'SYSTEM', null, 'PLATFORM_FEE', 0),
    ('00000000-0000-7000-8000-000000000003', 'SYSTEM', null, 'ADJUSTMENT', 0)`)
  for (const [key, value] of Object.entries(settings)) {
    await tx`insert into jhandi.platform_settings (key, value) values (${key}, ${value})
      on conflict (key) do update set value = excluded.value, updated_by = null`
  }
})
console.log('wiped', toWipe.length, 'tables; system accounts and platform_settings re-seeded:')
console.table(await sql`select key, value from jhandi.platform_settings order by key`)
await sql.end({ timeout: 5 })
