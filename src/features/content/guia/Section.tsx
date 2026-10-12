import type { ReactNode } from 'react'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'

/** Na impressão, nada pode ficar escondido à espera do scroll. */
export const REVEAL_PRINT = 'print:!translate-y-0 print:!opacity-100 print:!blur-none'

/**
 * Secção do guia com âncora. A margem de scroll deixa espaço para o cabeçalho fixo
 * (e, no telemóvel, para a barra do índice). Entrada subtil: o título sobe um pouco,
 * o conteúdo aparece em fade — texto de leitura não deve "dançar".
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
      <Reveal duration={800} className={REVEAL_PRINT}>
        <h2 id={`${id}-titulo`} className="text-3xl font-semibold text-ink sm:text-4xl">
          {title}
        </h2>
        {lead && <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-ink-mute sm:text-xl">{lead}</p>}
      </Reveal>
      <Reveal variant="fade" delay={120} duration={900} className={cn('mt-8 sm:mt-10', REVEAL_PRINT)}>
        {children}
      </Reveal>
    </section>
  )
}
