import type { ReactNode } from 'react'
import { LogoMark } from '@/components/layout/Logo'

/**
 * Moldura das páginas de conta, ao estilo do início de sessão da Apple:
 * página branca, coluna estreita e centrada, símbolo, um título grande e (opcional) uma frase.
 */
export function AuthShell({
  title,
  subtitle,
  mark,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** substitui o símbolo da marca (ex.: avatar da pessoa com sessão iniciada) */
  mark?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-[40rem] animate-fade-up px-5 pt-14 pb-24 sm:pt-20 sm:pb-32">
        <div className="flex flex-col items-center text-center">
          {mark ?? <LogoMark className="size-12" />}
          <h1 tabIndex={-1} className="mt-6 text-[2.5rem] leading-[1.08] font-semibold text-ink outline-none sm:text-5xl lg:text-[3.25rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-3 max-w-[28rem] text-lg text-ink-mute">{subtitle}</p>}
        </div>
        <div className="mx-auto mt-10 max-w-[28rem]">{children}</div>
      </div>
    </div>
  )
}
