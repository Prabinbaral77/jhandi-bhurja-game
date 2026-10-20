import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'
import { formatCoins } from '@/utils/format'

const MIN_DEPOSIT = 5_000

const inputClass = 'w-full rounded-lg border border-cream/20 bg-wood px-4 py-3 tabular-nums'

export default function CreateRoomPage() {
  const t = useT()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [deposit, setDeposit] = useState(MIN_DEPOSIT)
  const [minBet, setMinBet] = useState(10)
  const [maxBetPerSymbol, setMaxBetPerSymbol] = useState(1_000)
  const [bettingWindowSec, setBettingWindowSec] = useState(20)

  const create = useMutation(
    trpc.rooms.create.mutationOptions({
      onSuccess: ({ roomId }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.wallet.pathKey() })
        void queryClient.invalidateQueries({ queryKey: trpc.rooms.pathKey() })
        void navigate(`/room/${roomId}`)
      },
    }),
  )

  const numberField = (label: string, value: number, set: (n: number) => void, min: number) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-cream/80">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          set(Math.floor(Number(e.target.value)))
        }}
        className={inputClass}
      />
    </label>
  )

  return (
    <form
      className="mx-auto flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        create.mutate({ name, deposit, limits: { minBet, maxBetPerSymbol, bettingWindowSec } })
      }}
    >
      <h1 className="text-2xl font-bold">{t('createRoomTitle')}</h1>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-cream/80">{t('roomName')}</span>
        <input
          value={name}
          minLength={3}
          maxLength={40}
          required
          onChange={(e) => {
            setName(e.target.value)
          }}
          className={inputClass}
        />
      </label>
      {numberField(t('deposit'), deposit, setDeposit, MIN_DEPOSIT)}
      <p className="-mt-2 text-xs text-cream/60">
        {t('depositHint', { min: formatCoins(MIN_DEPOSIT) })}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {numberField(t('minBet'), minBet, setMinBet, 10)}
        {numberField(t('maxBetPerSymbol'), maxBetPerSymbol, setMaxBetPerSymbol, 100)}
      </div>
      {numberField(t('bettingWindow'), bettingWindowSec, setBettingWindowSec, 10)}
      <ErrorText error={create.error} />
      <Button type="submit" disabled={create.isPending || name.trim().length < 3}>
        {t('create')}
      </Button>
    </form>
  )
}
