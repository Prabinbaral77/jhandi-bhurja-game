import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

// `/r/:inviteToken` — opening the link grants access, then shows the room preview.
// Not signed in → RequireAuth sends the user to sign in and back here.
export default function InvitePage() {
  const { inviteToken = '' } = useParams()
  const t = useT()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const accept = useMutation(trpc.invite.accept.mutationOptions())

  useEffect(() => {
    if (inviteToken && accept.isIdle) accept.mutate({ inviteToken })
  }, [inviteToken, accept])

  if (accept.isError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3">
        <ErrorText error={accept.error} />
        <Link to="/rooms" className="text-marigold underline">
          {t('backToRooms')}
        </Link>
      </div>
    )
  }
  if (!accept.data) return <p className="text-cream/60">{t('connecting')}</p>

  const preview = accept.data
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 text-center">
      <p className="text-cream/70">{t('invitedTo')}</p>
      <h1 className="text-3xl font-bold text-marigold">{preview.name}</h1>
      <p className="text-cream/80">
        {t('host')}: {preview.host.displayName} · {t('members')}: {preview.members}/
        {preview.maxMembers}
      </p>
      <Button onClick={() => void navigate(`/room/${preview.roomId}`, { replace: true })}>
        {t('enterRoom')}
      </Button>
    </div>
  )
}
