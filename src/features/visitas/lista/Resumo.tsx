import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { MESES_LONGOS, pct } from '@/lib/format'
import { distritoDe } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Numero } from '@/features/lar-dashboard/shared/motion'
import type { FiltroDistrito, ResumoMes } from '../pipeline'

/**
 * Um número do mês. No telemóvel, uma fila de quatro (o número por cima, a etiqueta por baixo, sem notas) para a lista
 * começar logo a seguir; a partir de 640px, etiqueta, número e nota.
 */
function Kpi({ label, value, note, alerta, delay = 0 }: { label: string; value: ReactNode; note?: ReactNode; alerta?: boolean; delay?: number }) {
  return (
    <div className="flex min-w-0 flex-col motion-safe:animate-[fade-up_.6s_cubic-bezier(.16,1,.3,1)_both]" style={{ animationDelay: `${delay}ms` }}>
      <dt className="order-2 mt-1.5 text-sm leading-tight text-ink-mute sm:order-none sm:mt-0">{label}</dt>
      <dd className="order-1 text-[1.75rem] leading-none font-semibold tracking-tight text-ink tabular sm:order-none sm:mt-1 sm:text-4xl">{value}</dd>
      {note && <dd className={cn('order-3 mt-1.5 text-sm leading-snug text-ink-mute', !alerta && 'max-sm:hidden')}>{note}</dd>}
    </div>
  )
}

/** Os números do mês corrente no distrito escolhido: visitas, adesões, taxa de adesão e contactos a fazer. */
export function Resumo({ r, distrito, agora }: { r: ResumoMes; distrito: FiltroDistrito; agora: Date }) {
  const mes = MESES_LONGOS[agora.getMonth()]!
  const onde = distrito === 'todos' ? 'todos os distritos' : distritoDe(distrito)
  return (
    <section aria-labelledby="resumo-mes">
      <h2 id="resumo-mes" className="text-sm font-semibold tracking-normal text-ink-mute">
        <span className="capitalize">{mes}</span> · {onde}
      </h2>
      <dl className="mt-3 grid grid-cols-4 gap-x-3 sm:mt-4 sm:gap-x-8">
        <Kpi label="Visitas" value={<Numero value={r.visitas} duration={900} />} note="registadas este mês" />
        <Kpi delay={60} label="Adesões" value={<Numero value={r.adesoes} duration={900} />} note={r.adesoes === 1 ? 'instituição aderiu' : 'instituições aderiram'} />
        <Kpi
          delay={120}
          label="Taxa de adesão"
          value={
            r.taxaAdesao == null ? (
              <>
                <span aria-hidden>—</span>
                <span className="sr-only">por calcular</span>
              </>
            ) : (
              pct(r.taxaAdesao)
            )
          }
          note={r.taxaAdesao == null ? 'sem visitas este mês' : 'adesões por visita'}
        />
        <Kpi
          delay={180}
          label="Contactos a fazer"
          value={<Numero value={r.contactos} duration={900} />}
          alerta={r.atrasados > 0}
          note={
            r.atrasados ? (
              <span className="inline-flex items-center gap-1 font-medium text-alert-700">
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                {r.atrasados} em atraso
              </span>
            ) : (
              'nos próximos 7 dias'
            )
          }
        />
      </dl>
    </section>
  )
}
