import { useMutation } from '@tanstack/react-query'
import type { Invite } from '@jhandi/protocol/room'
import { useState } from 'react'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import { useT } from '@/lib/i18n'
import { recallInvite, rememberInvite } from '@/lib/inviteStore'
import { useTRPC } from '@/lib/trpc'

// Host-only: share link + code of a private room (docs/architecture.md §5.6).
export default function InvitePanel({ roomId }: { roomId: string }) {
  const t = useT()
  const trpc = useTRPC()
  const [invite, setInvite] = useState<Invite | null>(() => recallInvite(roomId))
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const reset = useMutation(
    trpc.invite.reset.mutationOptions({
      onSuccess: (fresh) => {
        rememberInvite(roomId, fresh)
        setInvite(fresh)
      },
    }),
  )

  const copy = async (what: 'link' | 'code') => {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(what === 'link' ? invite.inviteLink : invite.roomCode)
      setCopied(what)
      setTimeout(() => {
        setCopied(null)
      }, 1_500)
    } catch {
      // Clipboard blocked: the text is visible and selectable anyway.
    }
  }

  const share = async () => {
    if (!invite) return
    const text = t('shareText', { code: invite.roomCode, link: invite.inviteLink })
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('appName'), text })
      } catch {
        // User dismissed the share sheet.
      }
    } else {
      await copy('link')
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-jamara/40 bg-jamara/5 p-4">
      <h2 className="font-semibold text-jamara">{t('inviteTitle')}</h2>
      {invite ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-cream/70">{t('roomCode')}</span>
            <span className="select-all font-mono text-3xl font-bold tracking-[0.3em] text-marigold">
              {invite.roomCode}
            </span>
            <Button
              variant="secondary"
              className="min-h-9 text-sm"
              onClick={() => void copy('code')}
            >
              {copied === 'code' ? t('copied') : t('copy')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={invite.inviteLink}
              onFocus={(e) => {
                e.currentTarget.select()
              }}
              className="min-w-0 flex-1 rounded-lg border border-cream/20 bg-wood px-3 py-2 text-sm"
            />
            <Button
              variant="secondary"
              className="min-h-9 text-sm"
              onClick={() => void copy('link')}
            >
              {copied === 'link' ? t('copied') : t('copyLink')}
            </Button>
            <Button className="min-h-9 text-sm" onClick={() => void share()}>
              {t('share')}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-cream/70">{t('inviteMissing')}</p>
      )}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          className="min-h-9 text-sm"
          disabled={reset.isPending}
          onClick={() => {
            reset.mutate({ roomId })
          }}
        >
          {invite ? t('resetInvite') : t('newInvite')}
        </Button>
        <span className="text-xs text-cream/50">{t('resetInviteHint')}</span>
      </div>
      <ErrorText error={reset.error} />
    </section>
  )
}
