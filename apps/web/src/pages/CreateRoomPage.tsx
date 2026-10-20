import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { VENUES, type Venue } from '@jhandi/protocol/room'
import VenueBackdrop from '@/components/art/VenueBackdrop'
import { useT } from '@/lib/i18n'
import { rememberInvite } from '@/lib/inviteStore'
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
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [venue, setVenue] = useState<Venue>('NYATAPOLA')

  const create = useMutation(
    trpc.rooms.create.mutationOptions({
      onSuccess: ({ roomId, invite }) => {
        if (invite) rememberInvite(roomId, invite)
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
        create.mutate({
          name,
          visibility,
          venue,
          deposit,
          limits: { minBet, maxBetPerSymbol, bettingWindowSec },
        })
      }}
    >
      <h1 className="text-2xl font-bold">{t('createRoomTitle')}</h1>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('visibility')}>
        {(['PUBLIC', 'PRIVATE'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={visibility === v}
            onClick={() => {
              setVisibility(v)
            }}
            className={`flex flex-col gap-1 rounded-xl border p-3 text-left ${visibility === v ? 'border-marigold bg-marigold/10' : 'border-cream/15'}`}
          >
            <span className="font-semibold">{t(`visibility.${v}`)}</span>
            <span className="text-xs text-cream/60">{t(`visibility.${v}.hint`)}</span>
          </button>
        ))}
      </div>
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
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-cream/80">{t('venue')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {VENUES.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={venue === v}
              onClick={() => {
                setVenue(v)
              }}
              className={`overflow-hidden rounded-lg border-2 text-left ${venue === v ? 'border-marigold' : 'border-cream/15'}`}
            >
              <VenueBackdrop venue={v} className="h-16 w-full" />
              <span className="block px-2 py-1 text-xs">{t(`venue.${v}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
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
