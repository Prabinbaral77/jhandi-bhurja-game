import { reconcileLedger } from '@jhandi/ledger/reconcile'
import { db, sql } from '#lib/db'
import { logger } from '#lib/logger'

// Nightly ledger check (docs/database.md). Exit code 1 means coins were created or lost.
const report = await reconcileLedger(db)
logger[report.ok ? 'info' : 'error'](report, 'ledger reconciliation')
await sql.end({ timeout: 5 })
process.exit(report.ok ? 0 : 1)
