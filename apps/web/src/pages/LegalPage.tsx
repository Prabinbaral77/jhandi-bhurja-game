import { Link, Navigate, useParams } from 'react-router'
import { useLanguageStore, useT } from '@/lib/i18n'
import { LEGAL_DOCS, LEGAL_UPDATED, legalContent, type LegalDoc } from '@/content/legal'

const isLegalDoc = (value: string | undefined): value is LegalDoc =>
  (LEGAL_DOCS as string[]).includes(value ?? '')

// Public pages: Terms, Privacy, Responsible play (apps/web/src/content/legal.ts).
export default function LegalPage() {
  const { doc } = useParams()
  const language = useLanguageStore((s) => s.language)
  const t = useT()
  if (!isLegalDoc(doc)) return <Navigate to="/legal/terms" replace />
  const content = legalContent[language][doc]
  const label: Record<LegalDoc, string> = {
    terms: t('terms'),
    privacy: t('privacy'),
    'responsible-play': t('responsiblePlay'),
  }
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5">
      <nav className="flex flex-wrap gap-2 text-sm">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d}
            to={`/legal/${d}`}
            className={`rounded-md px-3 py-1.5 ${d === doc ? 'bg-marigold text-wood' : 'bg-cream/10 text-cream/80'}`}
          >
            {label[d]}
          </Link>
        ))}
      </nav>
      <header>
        <h1 className="text-2xl font-bold text-marigold">{content.title}</h1>
        <p className="mt-1 text-xs text-cream/50">
          {t('lastUpdated')} {LEGAL_UPDATED}
        </p>
        <p className="mt-3 text-cream/85">{content.intro}</p>
      </header>
      <p className="rounded-lg border border-marigold/40 bg-marigold/10 px-3 py-2 text-sm">
        {t('noCashValue')}
      </p>
      {content.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-sm leading-relaxed text-cream/85">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}
