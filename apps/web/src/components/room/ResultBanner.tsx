import { verifyRoll } from '@jhandi/game-rules/rng'
import type { RoundSettledMessage } from '@jhandi/protocol/room'
import { useState } from 'react'
import Button from '@/components/Button'
import { useT } from '@/lib/i18n'
import { formatCoins, formatSignedCoins } from '@/utils/format'

export default function ResultBanner({
  result,
  isHost,
}: {
  result: RoundSettledMessage
  isHost: boolean
}) {
  const t = useT()
  const [verified, setVerified] = useState<boolean | null>(null)

  const tone =
    result.yourNet > 0
      ? 'border-jamara bg-jamara/15'
      : result.yourNet < 0
        ? 'border-tika bg-tika/10'
        : 'border-cream/20'

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <p className="text-lg font-bold">
        {isHost
          ? t('hostResult', { n: formatSignedCoins(result.yourNet) })
          : result.yourNet > 0
            ? t('youWon', { n: formatCoins(result.yourNet) })
            : result.yourNet < 0
              ? t('youLost', { n: formatCoins(-result.yourNet) })
              : `${t('round')} #${result.roundNo}`}
      </p>
      {result.winners.length > 0 && (
        <p className="mt-1 text-sm text-cream/80">
          {t('winners')}:{' '}
          {result.winners
            .map((w) => `${w.displayName} +${formatCoins(w.won)} (${t(`symbol.${w.symbol}`)})`)
            .join(', ')}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          className="min-h-9 text-sm"
          onClick={() => {
            setVerified(
              verifyRoll(result.serverSeed, result.seedHash, result.roundId, result.dice).valid,
            )
          }}
        >
          {t('verifyFairness')}
        </Button>
        {verified !== null && (
          <span className={verified ? 'text-jamara' : 'text-tika'}>
            {verified ? t('verified') : t('verifyFailed')}
          </span>
        )}
      </div>
    </section>
  )
}
