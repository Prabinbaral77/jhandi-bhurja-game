// Nepali/Indian digit grouping: 1,00,000.
const coinFormat = new Intl.NumberFormat('en-IN')

export const formatCoins = (amount: number): string => coinFormat.format(amount)

export const formatSignedCoins = (amount: number): string =>
  `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${coinFormat.format(Math.abs(amount))}`

export const formatDateTime = (epochMs: number, language: 'ne' | 'en'): string =>
  new Intl.DateTimeFormat(language === 'ne' ? 'ne-NP' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kathmandu',
  }).format(epochMs)
