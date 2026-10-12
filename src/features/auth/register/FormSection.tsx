import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Secção numerada do registo: número grande em Fraunces na margem (no telemóvel, ao lado do título),
 * título, introdução e conteúdo.
 */
export function FormSection({
  n,
  id,
  title,
  intro,
  children,
  className,
}: {
  n: number
  id: string
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={cn('grid grid-cols-[auto_1fr] gap-x-4 sm:grid-cols-[3.5rem_1fr] sm:gap-x-6', className)}>
      <span
        aria-hidden
        className="font-display text-5xl leading-[0.9] font-semibold text-terra-500/90 tabular sm:pt-1 sm:text-right sm:text-6xl"
      >
        {n}
      </span>
      <div className="min-w-0 self-center sm:self-start">
        <h2 id={id} className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          <span className="sr-only">Passo {n}: </span>
          {title}
        </h2>
        {intro && <p className="mt-2 hidden max-w-2xl text-ink-soft sm:block">{intro}</p>}
      </div>
      {intro && <p className="col-span-2 mt-3 text-ink-soft sm:hidden">{intro}</p>}
      <div className="col-span-2 mt-6 min-w-0 sm:col-span-1 sm:col-start-2">{children}</div>
    </section>
  )
}
