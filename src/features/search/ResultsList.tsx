import { memo, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { LarCard } from '@/components/lar/LarCard'
import { CalcadaDivider } from '@/components/brand/patterns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { DispGlyph } from './Chips'
import { agrupar, type Entrada, type Grupo } from './filtering'
import type { Ordem } from './searchState'

export const PAGINA = 20

export const cardDomId = (id: string) => `resultado-${id}`

interface Props {
  resultados: Entrada[]
  ordem: Ordem
  visiveis: number
  onMais: () => void
  /** destaque vindo do mapa (passar o rato / escolher marcador) */
  destaqueId: string | null
  onHover: (id: string | null) => void
  mostrarDistancia: boolean
}

/** Lista editorial: grupos com título (h2) e cartões horizontais; paginada de 20 em 20. */
export const ResultsList = memo(function ResultsList({ resultados, ordem, visiveis, onMais, destaqueId, onHover, mostrarDistancia }: Props) {
  const parte = useMemo(() => resultados.slice(0, visiveis), [resultados, visiveis])
  const grupos = useMemo(() => agrupar(parte, resultados, ordem), [parte, resultados, ordem])
  const faltam = resultados.length - parte.length

  const cartao = (e: Entrada, h: 'h2' | 'h3') => (
    <li key={e.lar.id} id={cardDomId(e.lar.id)} className="scroll-mt-[calc(4.5rem+var(--barra,0px)+1.25rem)]">
      <LarCard
        lar={e.lar}
        layout="horizontal"
        distanciaKm={mostrarDistancia ? e.distanciaKm : undefined}
        selected={destaqueId === e.lar.id}
        onHover={onHover}
        headingLevel={h}
      />
    </li>
  )

  return (
    <div className="flex flex-col px-4 py-6 sm:px-6">
      {grupos ? (
        grupos.map((g, i) => (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className={cn(i > 0 && 'mt-4')}>
            {i > 0 && <CalcadaDivider color="#e2d8c8" height={12} className="mb-7 opacity-90" />}
            <CabecalhoGrupo g={g} />
            <ol className="mt-4 flex flex-col gap-4">{g.itens.map((e) => cartao(e, 'h3'))}</ol>
          </section>
        ))
      ) : (
        <ol className="flex flex-col gap-4">{parte.map((e) => cartao(e, 'h2'))}</ol>
      )}

      {faltam > 0 && (
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-dashed border-line-strong pt-6 text-center">
          <p className="text-sm text-ink-soft tabular">
            A mostrar {parte.length} de {resultados.length}
          </p>
          <Button variant="secondary" onClick={onMais} iconRight={<ChevronDown aria-hidden className="size-5" />}>
            Mostrar mais {Math.min(PAGINA, faltam)}
          </Button>
        </div>
      )}
    </div>
  )
})

function CabecalhoGrupo({ g }: { g: Grupo }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-3">
        {g.disp && <DispGlyph disp={g.disp} className="translate-y-0.5" />}
        <h2 id={`grupo-${g.id}`} className="font-display text-2xl font-semibold text-ink">
          {g.titulo}
          <span className="ml-3 font-medium text-ink-mute tabular">
            {g.total}
            <span className="sr-only"> {g.total === 1 ? 'instituição' : 'instituições'}</span>
          </span>
        </h2>
      </div>
      {g.descricao && <p className="max-w-[34rem] text-sm text-ink-soft">{g.descricao}</p>}
    </div>
  )
}
