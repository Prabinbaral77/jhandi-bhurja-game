import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

export default function JoinByCode() {
  const t = useT()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const join = useMutation(
    trpc.invite.joinByCode.mutationOptions({
      onSuccess: ({ roomId }) => void navigate(`/room/${roomId}`),
    }),
  )

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-cream/15 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        join.mutate({ roomCode: code })
      }}
    >
      <label className="text-sm text-cream/80" htmlFor="room-code">
        {t('joinWithCode')}
      </label>
      <div className="flex gap-2">
        <input
          id="room-code"
          value={code}
          maxLength={7}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="K7TQ2M"
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
          }}
          className="min-w-0 flex-1 rounded-lg border border-cream/20 bg-wood px-3 py-2 font-mono text-lg tracking-[0.3em] uppercase"
        />
        <Button type="submit" disabled={join.isPending || code.replace(/[\s-]/g, '').length !== 6}>
          {t('join')}
        </Button>
      </div>
      <ErrorText error={join.error} />
    </form>
  )
}
