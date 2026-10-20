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
          className={`size-14 rounded-full border-4 border-dashed text-sm font-bold tabular-nums shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.35),0_3px_6px_rgba(0,0,0,0.5)] transition-transform ${
            chip === value
              ? 'scale-110 border-cream bg-[radial-gradient(circle_at_40%_35%,#f7d97a,#c9a23a_60%,#8a6a1e)] text-wood'
              : 'border-brass/70 bg-[radial-gradient(circle_at_40%_35%,#e3c25c,#a8842a_60%,#6a5016)] text-wood/90 hover:scale-105'
          }`}
        >
          {formatCoins(chip)}
        </button>
      ))}
    </div>
  )
}
