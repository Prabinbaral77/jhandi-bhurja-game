import { useQuery } from '@tanstack/react-query'
import StatusCard from '@/components/StatusCard'
import { useGameServerPing } from '@/hooks/useGameServerPing'
import { useTRPC } from '@/lib/trpc'

export default function StatusPage() {
  const trpc = useTRPC()
  const health = useQuery({ ...trpc.health.check.queryOptions(), refetchInterval: 5_000 })
  const ping = useGameServerPing()

  const apiTone = health.isPending ? 'pending' : health.data?.ok ? 'ok' : 'error'
  const apiLines = health.data
    ? Object.entries(health.data.dependencies).map(([name, state]) => `${name}: ${state}`)
    : [health.error?.message ?? 'Checking…']

  const gameTone =
    ping.state === 'connected' ? 'ok' : ping.state === 'connecting' ? 'pending' : 'error'
  const gameLines =
    ping.state === 'connected'
      ? [`WebSocket connected`, `Round trip: ${ping.roundTripMs ?? '…'} ms`]
      : ping.state === 'error'
        ? [ping.message]
        : ['Connecting…']

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-marigold">झण्डी बुर्जा</h1>
        <p className="mt-1 text-cream/70">Nepal's game — system status</p>
      </header>
      <StatusCard title="API" tone={apiTone} lines={apiLines} />
      <StatusCard title="Game server" tone={gameTone} lines={gameLines} />
    </main>
  )
}
