import { errorMessageKey } from '@/lib/errors'
import { useT } from '@/lib/i18n'

export default function ErrorText({ error }: { error: unknown }) {
  const t = useT()
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-tika">
      {t(errorMessageKey(error))}
    </p>
  )
}
