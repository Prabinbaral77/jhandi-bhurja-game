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

await sql.begin(async (tx) => {
  await tx.unsafe(
    `truncate table ${toWipe.map((t) => `"jhandi"."${t}"`).join(', ')} restart identity cascade`,
  )
  // Same rows as migration 0002: fixed ids the ledger code relies on.
  await tx.unsafe(`insert into "jhandi"."accounts" ("id", "type", "owner_id", "code", "balance") values
    ('00000000-0000-7000-8000-000000000001', 'SYSTEM', null, 'BONUS', 0),
    ('00000000-0000-7000-8000-000000000002', 'SYSTEM', null, 'PLATFORM_FEE', 0),
    ('00000000-0000-7000-8000-000000000003', 'SYSTEM', null, 'ADJUSTMENT', 0)`)
})
console.log('wiped', toWipe.length, 'tables, system accounts re-seeded; platform_settings kept:')
console.table(await sql`select key, value from jhandi.platform_settings order by key`)
await sql.end({ timeout: 5 })
