import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Símbolo: um telhado em traço único e, por baixo, um ponto — alguém sob um teto, um lugar encontrado.
 * O ponto usa o gradiente da marca (azul → verde, o verde das vagas disponíveis).
 */
export function LogoMark({
  className,
  tone = 'ink',
  tile,
}: {
  className?: string
  tone?: 'ink' | 'light'
  /** ícone de app (fundo branco arredondado com contorno fino) — para notificações e cartões */
  tile?: boolean
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      {tile && <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#fff" stroke="#e5e5ea" />}
      <defs>
        <linearGradient id={`lg${id}`} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
          <stop offset="0" stopColor="#0a84ff" />
          <stop offset="1" stopColor="#30d158" />
        </linearGradient>
      </defs>
      <path
        transform={tile ? 'translate(4 3.6) scale(0.75)' : undefined}
        d="M6.6 14.6 16 6.4l9.4 8.2"
        fill="none"
        stroke={tone === 'light' ? '#ffffff' : '#1d1d1f'}
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="21.4" r="4.9" fill={`url(#lg${id})`} transform={tile ? 'translate(4 3.6) scale(0.75)' : undefined} />
    </svg>
  )
}

/** Logótipo completo: símbolo + nome em minúsculas, peso semibold e espaçamento apertado. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark tone={light ? 'light' : 'ink'} className="size-[1.9rem]" />
      <span className={cn('text-[1.375rem] leading-none font-semibold tracking-[-0.045em]', light ? 'text-white' : 'text-ink')}>
        encontralar
      </span>
    </span>
  )
}
