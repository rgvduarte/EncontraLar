import { useMemo } from 'react'
import type { Lar } from '@/types'
import type { MatchResult } from '@/lib/matching'
import { plural } from '@/lib/format'
import { ProximityRadar, RadarLegend } from '../controls/ProximityRadar'
import { pontoRadar } from '../area'
import { deLocal } from '../language'
import type { Rascunho } from '../model'

const NUMERADOS = 15

/** Mapa de proximidade das sugestões: números iguais aos da lista; clicar leva ao cartão. */
export function ResultsRadar({
  r,
  boas,
  outras,
  larPorId,
  destaque,
  onPonto,
}: {
  r: Rascunho
  boas: MatchResult[]
  outras: MatchResult[]
  larPorId: Map<string, Lar>
  destaque: string | null
  onPonto: (id: string) => void
}) {
  const local = r.local!
  const { pontos, extent } = useMemo(() => {
    const pts = [
      ...boas.map((m, i) => pontoRadar(larPorId.get(m.larId)!, i < NUMERADOS ? { rank: i + 1 } : {})),
      ...outras.map((m) => pontoRadar(larPorId.get(m.larId)!, { esbatido: true })),
    ]
    const longe = Math.max(0, ...boas.slice(0, NUMERADOS).map((m) => m.distanciaKm))
    return { pontos: pts, extent: Math.min(r.raioKm * 3, Math.max(r.raioKm * 1.2, longe * 1.08)) }
  }, [boas, outras, larPorId, r.raioKm])

  const dentro = boas.filter((m) => m.distanciaKm <= r.raioKm).length

  return (
    <section aria-labelledby="radar-t" className="rounded-4xl border border-line bg-white p-4 shadow-lift sm:p-5">
      <div className="px-1 pb-2">
        <h2 id="radar-t" className="font-display text-xl font-semibold text-ink">
          Quem fica <em>perto</em>
        </h2>
        <p className="text-sm text-ink-soft">
          {boas.length
            ? `${plural(dentro, 'sugestão', 'sugestões')} a menos de ${r.raioKm} km ${deLocal(local.label)}.`
            : `Nenhuma sugestão compatível a menos de ${r.raioKm} km.`}
        </p>
      </div>
      <ProximityRadar
        centro={local}
        raioKm={r.raioKm}
        pontos={pontos}
        extentKm={extent}
        destaque={destaque}
        onPonto={onPonto}
        rotuloCentro={local.label}
        titulo={`Mapa de proximidade com ${plural(boas.length, 'sugestão', 'sugestões')} à volta ${deLocal(local.label)}. A lista tem a mesma informação.`}
      />
      <RadarLegend numerado={boas.length > 0} esbatido={outras.length ? 'Esbatido: pouco compatível' : undefined} className="px-1 pt-2" />
    </section>
  )
}
