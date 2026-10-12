import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Secção do guia com âncora. A margem de scroll deixa espaço para o cabeçalho fixo
 * (e, no telemóvel, para a barra do índice).
 */
export function GuideSection({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string
  title: ReactNode
  lead?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} tabIndex={-1} className={cn('scroll-mt-36 outline-none lg:scroll-mt-24', className)}>
      <h2 id={`${id}-titulo`} className="text-3xl font-semibold text-ink sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink-mute sm:text-xl">{lead}</p>}
      <div className="mt-10">{children}</div>
    </section>
  )
}
