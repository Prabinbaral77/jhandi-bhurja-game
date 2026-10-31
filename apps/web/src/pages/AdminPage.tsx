import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useAuthStore } from '@/lib/authStore'
import { useTRPC } from '@/lib/trpc'
import { formatCoins, formatDateTime, formatSignedCoins } from '@/utils/format'

/**
 * Operator panel (docs/milestones.md M7). English only: staff tooling, not player-facing.
 * Every mutation here is written to the audit log by the API.
 */

type Tab = 'overview' | 'rooms' | 'coins' | 'users' | 'settings' | 'audit' | 'collusion'
const TABS: Tab[] = ['overview', 'rooms', 'coins', 'users', 'settings', 'audit', 'collusion']
const LIVE_REFRESH_MS = 10_000

const input = 'rounded-lg border border-cream/20 bg-wood px-3 py-2 text-sm'
const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm ${active ? 'bg-marigold text-wood' : 'bg-cream/10 text-cream/80'}`

export default function AdminPage() {
  const auth = useAuthStore((s) => s.auth)
  const [tab, setTab] = useState<Tab>('overview')
  if (auth.status !== 'signedIn' || !auth.user.isAdmin) {
    return <p className="text-tika">Admins only.</p>
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={tabClass(tab === t)}
            onClick={() => {
              setTab(t)
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'coins' && <CoinsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'collusion' && <CollusionTab />}
    </div>
  )
}

function UsersTab() {
  const trpc = useTRPC()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const results = useQuery({
    ...trpc.admin.searchUsers.queryOptions({ query: submitted }),
    enabled: submitted.length > 0,
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(query.trim())
          }}
        >
          <input
            className={`${input} min-w-0 flex-1`}
            placeholder="phone, e-mail, name or id"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
          />
          <Button type="submit" variant="secondary" className="min-h-9 text-sm">
            Search
          </Button>
        </form>
        <ul className="divide-y divide-cream/10 rounded-lg border border-cream/10">
          {results.data?.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-cream/5 ${selected === u.id ? 'bg-cream/10' : ''}`}
                onClick={() => {
                  setSelected(u.id)
                }}
              >
                <span className="font-semibold">{u.displayName}</span>{' '}
                <span className="text-cream/60">{u.email ?? u.phone}</span>
                <span
                  className={`ml-2 text-xs ${u.status === 'ACTIVE' ? 'text-jamara' : 'text-tika'}`}
                >
                  {u.status}
                </span>
              </button>
            </li>
          ))}
          {results.data?.length === 0 && (
            <li className="px-3 py-2 text-sm text-cream/60">No users</li>
          )}
        </ul>
      </div>
      {selected !== null && <UserDetail userId={selected} />}
    </div>
  )
}

function UserDetail({ userId }: { userId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(0)
  const user = useQuery(trpc.admin.getUser.queryOptions({ userId }))
  const ledger = useQuery(trpc.admin.userLedger.queryOptions({ userId, limit: 20 }))
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
  }
  const setStatus = useMutation(trpc.admin.setUserStatus.mutationOptions({ onSuccess: refresh }))
  const adjust = useMutation(trpc.admin.adjustCoins.mutationOptions({ onSuccess: refresh }))
  const data = user.data
  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-cream/15 p-4">
        <h2 className="text-lg font-semibold">{data.displayName}</h2>
        <p className="text-sm text-cream/70">
          {data.email ?? data.phone ?? '—'} · {data.id}
        </p>
        <p className="mt-1 text-sm">
          Balance <b className="tabular-nums">{formatCoins(data.balance)}</b> · Status{' '}
          <b className={data.status === 'ACTIVE' ? 'text-jamara' : 'text-tika'}>{data.status}</b>
          {data.isAdmin && ' · admin'} · Joined {formatDateTime(data.createdAt, 'en')}
        </p>
        {data.sameIpAccounts > 0 && (
          <p className="mt-1 text-sm text-marigold">
            ⚠ {data.sameIpAccounts} other account(s) signed up from the same IP
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-cream/15 p-4">
        <h3 className="font-semibold">Actions (reason required, audited)</h3>
        <input
          className={input}
          placeholder="reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
          }}
        />
        <div className="flex flex-wrap gap-2">
          {(['ACTIVE', 'FROZEN', 'BANNED'] as const).map((status) => (
            <Button
              key={status}
              variant="secondary"
              className="min-h-9 text-sm"
              disabled={reason.trim().length < 3 || data.status === status || setStatus.isPending}
              onClick={() => {
                setStatus.mutate({ userId, status, reason })
              }}
            >
              Set {status}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            className={`${input} w-32`}
            value={amount}
            onChange={(e) => {
              setAmount(Math.trunc(Number(e.target.value)))
            }}
          />
          <Button
            variant="secondary"
            className="min-h-9 text-sm"
            disabled={amount === 0 || reason.trim().length < 3 || adjust.isPending}
            onClick={() => {
              adjust.mutate({ userId, amount, reason, idempotencyKey: crypto.randomUUID() })
            }}
          >
            Adjust coins ({formatSignedCoins(amount)})
          </Button>
        </div>
        <ErrorText error={setStatus.error ?? adjust.error} />
      </section>

      <section>
        <h3 className="mb-2 font-semibold">Ledger (latest 20)</h3>
        <ul className="divide-y divide-cream/10 rounded-lg border border-cream/10 text-sm">
          {ledger.data?.items.map((e) => (
            <li key={e.id} className="flex justify-between px-3 py-1.5">
              <span>
                {e.kind}{' '}
                <span className="text-cream/50">
                  {e.refType} {e.refId?.slice(0, 8)}
                </span>
              </span>
              <span className={`tabular-nums ${e.amount >= 0 ? 'text-jamara' : 'text-tika'}`}>
                {formatSignedCoins(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}) {
  const color = tone === 'good' ? 'text-jamara' : tone === 'warn' ? 'text-marigold' : ''
  return (
    <div className="rounded-xl border border-cream/15 bg-cream/5 p-3">
      <p className="text-xs uppercase tracking-wide text-cream/60">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-xs text-cream/60">{hint}</p>}
    </div>
  )
}

function OverviewTab() {
  const trpc = useTRPC()
  const overview = useQuery({
    ...trpc.admin.overview.queryOptions(),
    refetchInterval: LIVE_REFRESH_MS,
  })
  const o = overview.data
  if (!o) return <p className="text-sm text-cream/60">Loading…</p>
  const seated = o.rooms.hosts + o.rooms.players + o.rooms.spectators
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-cream/50">
        Live · refreshes every {LIVE_REFRESH_MS / 1000} s · as of{' '}
        {formatDateTime(o.generatedAt, 'en')}
      </p>
      <section>
        <h2 className="mb-2 font-semibold">Games right now</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="Live rooms" value={String(o.rooms.live)} tone="good" />
          <StatCard label="Rounds in play" value={String(o.rooms.roundsInPlay)} />
          <StatCard
            label="People seated"
            value={String(seated)}
            hint={`${o.rooms.hosts} hosts · ${o.rooms.players} players · ${o.rooms.spectators} watching`}
          />
          <StatCard label="Rounds settled today" value={String(o.platformFee.roundsToday)} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Platform fee (coins)</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="Today" value={formatCoins(o.platformFee.today)} tone="good" />
          <StatCard label="Last 7 days" value={formatCoins(o.platformFee.last7Days)} />
          <StatCard label="All time" value={formatCoins(o.platformFee.total)} />
          <StatCard
            label="Per settled round today"
            value={
              o.platformFee.roundsToday > 0
                ? formatCoins(Math.round(o.platformFee.today / o.platformFee.roundsToday))
                : '—'
            }
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Where the coins are</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <StatCard label="In player wallets" value={formatCoins(o.coins.inWallets)} />
          <StatCard label="In room banks" value={formatCoins(o.coins.inRoomBanks)} />
          <StatCard label="At stake (escrow)" value={formatCoins(o.coins.inEscrow)} />
          <StatCard label="Bonuses issued" value={formatCoins(o.coins.bonusesIssued)} />
          <StatCard
            label="Admin adjustments (net)"
            value={formatSignedCoins(o.coins.adjustmentsNet)}
            tone={o.coins.adjustmentsNet !== 0 ? 'warn' : 'default'}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Users</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatCard label="Total" value={String(o.users.total)} />
          <StatCard label="Signed up today" value={String(o.users.signedUpToday)} />
          <StatCard label="Placed a bet today" value={String(o.users.betToday)} />
          <StatCard
            label="Frozen / banned"
            value={String(o.users.frozenOrBanned)}
            tone={o.users.frozenOrBanned > 0 ? 'warn' : 'default'}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Fee by day (Kathmandu, last 14 days)</h2>
        <table className="w-full max-w-md text-sm">
          <thead className="text-left text-cream/60">
            <tr>
              <th className="p-1">Day</th>
              <th className="p-1 text-right">Rounds</th>
              <th className="p-1 text-right">Fee</th>
            </tr>
          </thead>
          <tbody>
            {o.feeByDay.map((d) => (
              <tr key={d.date} className="border-t border-cream/10">
                <td className="p-1">{d.date}</td>
                <td className="p-1 text-right tabular-nums">{d.rounds}</td>
                <td className="p-1 text-right tabular-nums">{formatCoins(d.fee)}</td>
              </tr>
            ))}
            {o.feeByDay.length === 0 && (
              <tr>
                <td className="p-1 text-cream/60" colSpan={3}>
                  No settled rounds yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function RoomsTab() {
  const trpc = useTRPC()
  const [scope, setScope] = useState<'live' | 'all'>('live')
  const [open, setOpen] = useState<string | null>(null)
  const rooms = useQuery({
    ...trpc.admin.rooms.queryOptions({ scope }),
    refetchInterval: scope === 'live' ? LIVE_REFRESH_MS : false,
  })
  const totalFee = rooms.data?.reduce((n, r) => n + r.platformFee, 0) ?? 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(['live', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={tabClass(scope === s)}
            onClick={() => {
              setScope(s)
            }}
          >
            {s === 'live' ? 'Live rooms' : 'All rooms'}
          </button>
        ))}
        <span className="text-cream/60">
          {rooms.data?.length ?? 0} rooms · fee collected {formatCoins(totalFee)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-cream/60">
            <tr>
              <th className="p-2">Room</th>
              <th className="p-2">Host</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Seated</th>
              <th className="p-2 text-right">Bank</th>
              <th className="p-2 text-right">Rounds</th>
              <th className="p-2 text-right">Lost stakes</th>
              <th className="p-2 text-right">Paid out</th>
              <th className="p-2 text-right">Platform fee</th>
              <th className="p-2">Last round</th>
            </tr>
          </thead>
          <tbody>
            {rooms.data?.map((r) => (
              <Fragment key={r.roomId}>
                <tr
                  className="cursor-pointer border-t border-cream/10 hover:bg-cream/5"
                  onClick={() => {
                    setOpen(open === r.roomId ? null : r.roomId)
                  }}
                >
                  <td className="p-2">
                    {r.name}{' '}
                    <span className="text-cream/40">
                      {r.visibility === 'PRIVATE' ? '🔒 ' : ''}
                      {r.roomId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="p-2">{r.host.displayName}</td>
                  <td className="p-2">
                    {r.roundInPlay ? (
                      <span className="text-jamara">● playing</span>
                    ) : (
                      <span className={r.status === 'CLOSED' ? 'text-cream/50' : ''}>
                        {r.status.toLowerCase()}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">{r.members}</td>
                  <td className="p-2 text-right tabular-nums">{formatCoins(r.bankBalance)}</td>
                  <td className="p-2 text-right tabular-nums">{r.rounds}</td>
                  <td className="p-2 text-right tabular-nums">{formatCoins(r.losingStakes)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCoins(r.winningsPaid)}</td>
                  <td className="p-2 text-right font-semibold tabular-nums text-marigold">
                    {formatCoins(r.platformFee)}
                  </td>
                  <td className="p-2">
                    {r.lastRoundAt ? formatDateTime(r.lastRoundAt, 'en') : '—'}
                  </td>
                </tr>
                {open === r.roomId && (
                  <tr className="border-t border-cream/10 bg-cream/5">
                    <td colSpan={10} className="p-2">
                      <RoomRounds roomId={r.roomId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rooms.data?.length === 0 && (
              <tr>
                <td className="p-2 text-cream/60" colSpan={10}>
                  No rooms
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoomRounds({ roomId }: { roomId: string }) {
  const trpc = useTRPC()
  const rounds = useQuery({
    ...trpc.admin.roomRounds.queryOptions({ roomId }),
    refetchInterval: LIVE_REFRESH_MS,
  })
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-cream/60">
        <tr>
          <th className="p-1">Round</th>
          <th className="p-1">Status</th>
          <th className="p-1">Dice</th>
          <th className="p-1 text-right">Bets</th>
          <th className="p-1 text-right">Staked</th>
          <th className="p-1 text-right">Lost stakes</th>
          <th className="p-1 text-right">Paid out</th>
          <th className="p-1 text-right">Fee</th>
          <th className="p-1">Settled</th>
        </tr>
      </thead>
      <tbody>
        {rounds.data?.map((r) => (
          <tr key={r.roundId} className="border-t border-cream/10">
            <td className="p-1">#{r.roundNo}</td>
            <td className="p-1">{r.status.toLowerCase()}</td>
            <td className="p-1">{r.dice?.map((d) => d.toLowerCase()).join(' ') ?? '—'}</td>
            <td className="p-1 text-right tabular-nums">{r.bets}</td>
            <td className="p-1 text-right tabular-nums">{formatCoins(r.staked)}</td>
            <td className="p-1 text-right tabular-nums">{formatCoins(r.losingStakes)}</td>
            <td className="p-1 text-right tabular-nums">{formatCoins(r.winningsPaid)}</td>
            <td className="p-1 text-right tabular-nums text-marigold">
              {formatCoins(r.platformFee)}
            </td>
            <td className="p-1">{r.settledAt ? formatDateTime(r.settledAt, 'en') : '—'}</td>
          </tr>
        ))}
        {rounds.data?.length === 0 && (
          <tr>
            <td className="p-1 text-cream/60" colSpan={9}>
              No rounds yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

// Who holds the coins, and hand some out from here (same audited ledger adjustment as the
// user card).
function CoinsTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const holders = useQuery({
    ...trpc.admin.topBalances.queryOptions({ limit: 100 }),
    refetchInterval: LIVE_REFRESH_MS,
  })
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [amount, setAmount] = useState(1_000)
  const [reason, setReason] = useState('')
  const adjust = useMutation(
    trpc.admin.adjustCoins.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
        setTarget(null)
      },
    }),
  )
  const total = holders.data?.reduce((n, u) => n + u.balance, 0) ?? 0
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cream/60">
        Top {holders.data?.length ?? 0} wallets hold {formatCoins(total)} coins. Click a row to give
        or take coins (audited). For other users, search in the Users tab.
      </p>
      {target && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-marigold/40 p-3">
          <span className="text-sm">
            Adjust <b>{target.name}</b>
          </span>
          <input
            type="number"
            className={`${input} w-32`}
            value={amount}
            onChange={(e) => {
              setAmount(Math.trunc(Number(e.target.value)))
            }}
          />
          <input
            className={`${input} min-w-0 flex-1`}
            placeholder="reason (required)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
            }}
          />
          <Button
            variant="secondary"
            className="min-h-9 text-sm"
            disabled={amount === 0 || reason.trim().length < 3 || adjust.isPending}
            onClick={() => {
              adjust.mutate({
                userId: target.id,
                amount,
                reason,
                idempotencyKey: crypto.randomUUID(),
              })
            }}
          >
            {amount >= 0 ? 'Give' : 'Take'} {formatCoins(Math.abs(amount))}
          </Button>
          <Button
            variant="secondary"
            className="min-h-9 text-sm"
            onClick={() => {
              setTarget(null)
            }}
          >
            Cancel
          </Button>
          <ErrorText error={adjust.error} />
        </section>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-cream/60">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">User</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {holders.data?.map((u, i) => (
              <tr
                key={u.id}
                className={`cursor-pointer border-t border-cream/10 hover:bg-cream/5 ${target?.id === u.id ? 'bg-cream/10' : ''}`}
                onClick={() => {
                  setTarget({ id: u.id, name: u.displayName })
                }}
              >
                <td className="p-2 text-cream/50">{i + 1}</td>
                <td className="p-2">
                  {u.displayName}
                  {u.isAdmin && <span className="ml-1 text-xs text-marigold">admin</span>}
                </td>
                <td className="p-2 text-cream/70">{u.email ?? u.phone ?? '—'}</td>
                <td className={`p-2 ${u.status === 'ACTIVE' ? '' : 'text-tika'}`}>
                  {u.status.toLowerCase()}
                </td>
                <td className="p-2 text-right font-semibold tabular-nums">
                  {formatCoins(u.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettingsTab() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const settings = useQuery(trpc.admin.settings.queryOptions())
  const update = useMutation(
    trpc.admin.updateSetting.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.admin.pathKey() })
      },
    }),
  )
  const [draft, setDraft] = useState<Record<string, number>>({})
  return (
    <div className="flex max-w-md flex-col gap-2">
      {Object.entries(settings.data ?? {}).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-56 text-sm">{key}</span>
          <input
            type="number"
            className={`${input} w-32`}
            value={draft[key] ?? value}
            onChange={(e) => {
              setDraft({ ...draft, [key]: Math.trunc(Number(e.target.value)) })
            }}
          />
          <Button
            variant="secondary"
            className="min-h-9 text-sm"
            disabled={(draft[key] ?? value) === value || update.isPending}
            onClick={() => {
              update.mutate({ key, value: draft[key] ?? value })
            }}
          >
            Save
          </Button>
        </div>
      ))}
      <ErrorText error={update.error} />
    </div>
  )
}

function AuditTab() {
  const trpc = useTRPC()
  const audit = useQuery(trpc.admin.audit.queryOptions({ limit: 50 }))
  return (
    <ul className="divide-y divide-cream/10 rounded-lg border border-cream/10 text-sm">
      {audit.data?.items.map((e) => (
        <li key={e.id} className="px-3 py-2">
          <span className="text-cream/50">{formatDateTime(e.createdAt, 'en')}</span>{' '}
          <b>{e.actor?.displayName ?? 'system'}</b> {e.action}{' '}
          <span className="text-cream/70">{e.target}</span>
          <pre className="mt-1 whitespace-pre-wrap text-xs text-cream/60">
            {JSON.stringify(e.data)}
          </pre>
        </li>
      ))}
      {audit.data?.items.length === 0 && <li className="px-3 py-2 text-cream/60">No entries</li>}
    </ul>
  )
}

function CollusionTab() {
  const trpc = useTRPC()
  const flags = useQuery(trpc.admin.collusion.queryOptions({ days: 7, minNetWon: 3_000 }))
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-cream/60">
        Players who won ≥ 3,000 net from one host's bank in the last 7 days. Private rooms deserve a
        closer look.
      </p>
      <ul className="divide-y divide-cream/10 rounded-lg border border-cream/10 text-sm">
        {flags.data?.map((f) => (
          <li
            key={`${f.roomId}-${f.player.id}`}
            className="flex flex-wrap justify-between gap-2 px-3 py-2"
          >
            <span>
              {f.player.displayName} ← {f.host.displayName}{' '}
              <span className="text-cream/50">
                ({f.roomName}, {f.visibility})
              </span>
            </span>
            <span className="tabular-nums text-marigold">
              +{formatCoins(f.netWon)} in {f.bets} bets
            </span>
          </li>
        ))}
        {flags.data?.length === 0 && <li className="px-3 py-2 text-cream/60">Nothing flagged</li>}
      </ul>
    </div>
  )
}
