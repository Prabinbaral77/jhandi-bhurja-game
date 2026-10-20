import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-marigold text-wood hover:bg-marigold/90 disabled:bg-marigold/40',
  secondary: 'border border-cream/30 text-cream hover:bg-cream/10 disabled:opacity-40',
  ghost: 'text-cream/70 hover:text-cream disabled:opacity-40',
}

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marigold disabled:cursor-not-allowed'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export default function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props} />
}
