import Button from '@/components/Button'
import { useT } from '@/lib/i18n'
import { sfx, useSoundStore } from '@/lib/sound'

export default function SoundToggle() {
  const t = useT()
  const { muted, toggle } = useSoundStore()
  return (
    <Button
      variant="ghost"
      className="min-h-9 px-2 text-base"
      aria-label={muted ? t('soundOn') : t('soundOff')}
      title={muted ? t('soundOn') : t('soundOff')}
      onClick={() => {
        toggle()
        if (muted) sfx('coin')
      }}
    >
      {muted ? '🔇' : '🔔'}
    </Button>
  )
}
