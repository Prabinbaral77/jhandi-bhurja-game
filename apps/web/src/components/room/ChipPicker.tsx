import { useT } from '@/lib/i18n'
import { formatCoins } from '@/utils/format'

const CHIPS = [10, 50, 100, 500, 1_000]

interface ChipPickerProps {
  value: number
  minBet: number
  maxBet: number
  onChange: (value: number) => void
}

export default function ChipPicker({ value, minBet, maxBet, onChange }: ChipPickerProps) {
  const t = useT()
  const chips = CHIPS.filter((c) => c >= minBet && c <= maxBet)
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('chip')}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          role="radio"
          aria-checked={chip === value}
          onClick={() => {
            onChange(chip)
          }}
          className={`size-14 rounded-full border-4 text-sm font-bold tabular-nums transition-transform ${
            chip === value
              ? 'scale-110 border-marigold bg-brass text-wood'
              : 'border-brass/60 bg-wood text-cream hover:border-marigold'
          }`}
        >
          {formatCoins(chip)}
        </button>
      ))}
    </div>
  )
}
