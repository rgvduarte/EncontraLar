import { cn } from '@/lib/cn'

/** Símbolo: casa em traço fino + ponto verde ("há vaga"). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <rect width="32" height="32" rx="9" fill="#1d1d1f" />
      <path d="M9 15.2 16 9.5l7 5.7V23a1 1 0 0 1-1 1h-3.6v-4.6h-4.8V24H10a1 1 0 0 1-1-1v-7.8Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="24.2" cy="8.2" r="3.4" fill="#34c759" stroke="#1d1d1f" strokeWidth="1.6" />
    </svg>
  )
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-[1.3125rem] leading-none font-semibold tracking-[-0.03em]', light ? 'text-white' : 'text-ink')}>EncontraLar</span>
    </span>
  )
}
