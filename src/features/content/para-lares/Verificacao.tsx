/**
 * A verificação em quatro passos, numa linha: pedido → licença → visita → selo.
 */
import { useMemo } from 'react'
import { useLares } from '@/lib/store'
import { num } from '@/lib/format'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'
import { SectionTitle } from '../shared/ui'

const PASSOS = [
  { t: 'Pedido', d: 'Regista a instituição e o número da licença.' },
  { t: 'Licença', d: 'Confirmamos a licença emitida pela Segurança Social.' },
  { t: 'Visita', d: 'Visitamos a casa, em data combinada consigo.' },
  { t: 'Selo', d: 'Aparece na ficha, com a data. Renova-se todos os anos.' },
] as const

export function Verificacao() {
  const lares = useLares()
  const verificadas = useMemo(() => lares.filter((l) => l.verificacao.estado === 'verificado').length, [lares])

  return (
    <section aria-labelledby="pl-verificacao" className="bg-sand">
      <div className="container-page py-24 sm:py-32 lg:py-40">
        <Reveal className="flex flex-col items-center">
          <SeloVerificado size={84} className="mb-8" />
          <SectionTitle
            id="pl-verificacao"
            title="Verificadas, uma a uma."
            subtitle={`O selo não se compra, e é igual em todos os planos. ${num(verificadas)} das ${num(lares.length)} instituições do mapa já o têm.`}
          />
        </Reveal>

        <ol className="relative mx-auto mt-16 grid max-w-5xl gap-10 sm:mt-20 md:grid-cols-4 md:gap-6">
          <span aria-hidden className="absolute top-[0.6rem] right-[12.5%] left-[12.5%] hidden h-px bg-line-strong md:block" />
          {PASSOS.map((p, i) => (
            <Reveal as="li" key={p.t} delay={i * 90} className="relative flex gap-5 md:flex-col md:items-center md:gap-5 md:text-center">
              <span
                aria-hidden
                className={cn(
                  'relative mt-1 size-5 shrink-0 rounded-full border shadow-[0_0_0_8px_var(--color-sand)]',
                  i === PASSOS.length - 1 ? 'border-terra-600 bg-terra-600' : 'border-line-strong bg-white',
                )}
              />
              <div>
                <h3 className="text-xl font-semibold text-ink">
                  <span className="sr-only">Passo {i + 1}: </span>
                  {p.t}
                </h3>
                <p className="mt-1.5 text-base text-ink-mute md:mx-auto md:max-w-[22ch]">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
