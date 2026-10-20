import { formatCoins } from '@/utils/format'

interface CoinAmountProps {
  amount: number
  className?: string
}

export default function CoinAmount({ amount, className = '' }: CoinAmountProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <span
        className="inline-block size-[1em] rounded-full border-2 border-brass bg-marigold/80"
        aria-hidden
      />
      {formatCoins(amount)}
    </span>
  )
}
