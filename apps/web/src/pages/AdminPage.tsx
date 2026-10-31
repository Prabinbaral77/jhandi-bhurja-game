import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useAuthStore } from '@/lib/authStore'
import { useTRPC } from '@/lib/trpc'
import { formatCoins, formatDateTime, formatSignedCoins } from '@/utils/format'

/**
 * Operator panel (docs/milestones.md M7). English only: staff tooling, not player-facing.
 * Every mutation here is written to the audit log by the API.
 */

type Tab = 'users' | 'rooms' | 'settings' | 'audit' | 'collusion'
const TABS: Tab[] = ['users', 'rooms', 'settings', 'audit', 'collusion']

const input = 'rounded-lg border border-cream/20 bg-wood px-3 py-2 text-sm'
const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm ${active ? 'bg-marigold text-wood' : 'bg-cream/10 text-cream/80'}`

export default function AdminPage() {
  const auth = useAuthStore((s) => s.auth)
  const [tab, setTab] = useState<Tab>('users')
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
      {tab === 'users' && <UsersTab />}
      {tab === 'rooms' && <RoomsTab />}
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
            placeholder="phone, name or id"
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
                <span className="text-cream/60">{u.phone}</span>
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
          {data.phone ?? '—'} · {data.id}
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

function RoomsTab() {
  const trpc = useTRPC()
  const rooms = useQuery(trpc.admin.rooms.queryOptions())
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-cream/60">
          <tr>
            <th className="p-2">Room</th>
            <th className="p-2">Host</th>
            <th className="p-2">Type</th>
            <th className="p-2">Status</th>
            <th className="p-2 text-right">Bank</th>
            <th className="p-2 text-right">Rounds</th>
            <th className="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rooms.data?.map((r) => (
            <tr key={r.roomId} className="border-t border-cream/10">
              <td className="p-2">
                {r.name} <span className="text-cream/40">{r.roomId.slice(0, 8)}</span>
              </td>
              <td className="p-2">{r.host.displayName}</td>
              <td className="p-2">{r.visibility}</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2 text-right tabular-nums">{formatCoins(r.bankBalance)}</td>
              <td className="p-2 text-right tabular-nums">{r.rounds}</td>
              <td className="p-2">{formatDateTime(r.createdAt, 'en')}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
