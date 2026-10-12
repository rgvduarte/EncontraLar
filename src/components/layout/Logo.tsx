import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-10', className)}>
      <path d="M20 2.5c-8.6 0-15.5 6.7-15.5 15.1 0 10.4 12.1 19.1 14.6 20.8.5.4 1.3.4 1.8 0 2.5-1.7 14.6-10.4 14.6-20.8C35.5 9.2 28.6 2.5 20 2.5Z" fill="#1d564e" />
      <path d="M11.5 18.2 20 11l8.5 7.2v8.3a1.5 1.5 0 0 1-1.5 1.5H13a1.5 1.5 0 0 1-1.5-1.5v-8.3Z" fill="#fbf8f3" />
      <path d="M20 25.4s-4.2-2.6-4.2-5.3c0-1.3 1-2.3 2.2-2.3.9 0 1.6.5 2 1.2.4-.7 1.1-1.2 2-1.2 1.2 0 2.2 1 2.2 2.3 0 2.7-4.2 5.3-4.2 5.3Z" fill="#d25b3b" />
    </svg>
  )
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('font-display text-2xl leading-none font-semibold tracking-tight', light ? 'text-white' : 'text-pine-900')}>
        Encontra<span className={light ? 'text-terra-300' : 'text-terra-600'}>Lar</span>
      </span>
    </span>
  )
}
