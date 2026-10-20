import type { SignInOutput } from '@jhandi/protocol/auth'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useState, type SubmitEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import Button from '@/components/Button'
import ErrorText from '@/components/ErrorText'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import { useCountdown } from '@/hooks/useCountdown'
import { useAuthStore } from '@/lib/authStore'
import { useT } from '@/lib/i18n'
import { useTRPC } from '@/lib/trpc'

const secondsFromNow = (seconds: number) => Date.now() + seconds * 1_000

const inputClass =
  'w-full rounded-lg border border-cream/20 bg-wood px-4 py-3 text-lg tracking-wide text-cream placeholder:text-cream/30 focus:border-marigold focus:outline-none'

export default function SignInPage() {
  const t = useT()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((s) => s.auth.status)
  const setSession = useAuthStore((s) => s.setSession)

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState<{ phone: string; resendAt: number; devCode?: string } | null>(
    null,
  )
  const secondsToResend = useCountdown(sent?.resendAt ?? null)
  const config = useQuery(trpc.auth.config.queryOptions())

  const onSignedIn = useCallback(
    (session: SignInOutput) => {
      setSession(session)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      void navigate(session.isNewUser ? '/welcome' : from, {
        replace: true,
        state: { signupBonus: session.signupBonus },
      })
    },
    [location.state, navigate, setSession],
  )

  const requestOtp = useMutation(
    trpc.auth.requestOtp.mutationOptions({
      onSuccess: (result, input) => {
        setSent({
          phone: input.phone,
          resendAt: secondsFromNow(result.resendAfterSec),
          ...(result.devCode ? { devCode: result.devCode } : {}),
        })
        setCode('')
      },
    }),
  )
  const verifyOtp = useMutation(trpc.auth.verifyOtp.mutationOptions({ onSuccess: onSignedIn }))
  const google = useMutation(trpc.auth.google.mutationOptions({ onSuccess: onSignedIn }))
  const onGoogleCredential = useCallback(
    (idToken: string) => {
      google.mutate({ idToken })
    },
    [google],
  )

  if (status === 'signedIn') return <Navigate to="/" replace />

  const submitPhone = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    requestOtp.mutate({ phone })
  }
  const submitCode = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sent) verifyOtp.mutate({ phone: sent.phone, code })
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-marigold">{t('appName')}</h1>
        <p className="mt-1 text-cream/70">{t('tagline')}</p>
      </header>

      {sent === null ? (
        <form onSubmit={submitPhone} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-cream/80">{t('phoneLabel')}</span>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('phonePlaceholder')}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
              }}
              required
            />
          </label>
          <ErrorText error={requestOtp.error} />
          <Button type="submit" disabled={requestOtp.isPending || phone.trim().length < 10}>
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-3">
          <p className="text-sm text-cream/80">
            {t('codeSentTo')} <span className="font-semibold">{sent.phone}</span>
          </p>
          {sent.devCode && (
            <p className="rounded-lg border border-marigold/40 bg-marigold/10 p-3 text-sm">
              {t('devCodeNotice')}{' '}
              <span className="font-mono text-lg font-bold tracking-widest">{sent.devCode}</span>
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-cream/80">{t('codeLabel')}</span>
            <input
              className={`${inputClass} text-center font-mono tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''))
              }}
              required
            />
          </label>
          <ErrorText error={verifyOtp.error ?? requestOtp.error} />
          <Button type="submit" disabled={verifyOtp.isPending || code.length !== 6}>
            {t('verify')}
          </Button>
          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setSent(null)
              }}
            >
              {t('changeNumber')}
            </Button>
            <Button
              variant="ghost"
              disabled={secondsToResend > 0 || requestOtp.isPending}
              onClick={() => {
                requestOtp.mutate({ phone: sent.phone })
              }}
            >
              {secondsToResend > 0 ? t('resendIn', { s: secondsToResend }) : t('resend')}
            </Button>
          </div>
        </form>
      )}

      {config.data?.googleEnabled && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-cream/50">{t('orContinueWith')}</p>
          <GoogleSignInButton onCredential={onGoogleCredential} />
          <ErrorText error={google.error} />
        </div>
      )}
    </div>
  )
}
