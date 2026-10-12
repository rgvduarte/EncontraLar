import { Building2 } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { euro, num } from '@/lib/format'
import type { HomeStats } from './homeData'

/** Faixa escura para quem gere uma instituição. */
export function InstitutionsBand({ stats }: { stats: HomeStats }) {
  const factos = [
    { valor: num(stats.visualizacoes), texto: 'visitas de famílias a fichas de instituições nos últimos 30 dias' },
    { valor: num(stats.listaEspera), texto: 'pessoas inscritas em listas de espera, à espera de uma vaga' },
    { valor: euro(stats.mensalidadeMedia), texto: 'mensalidade média que fica por receber por cada mês com uma cama vazia' },
  ]
  return (
    <section aria-labelledby="instituicoes-titulo" className="on-dark bg-pine-950 text-pine-50" style={calcadaStonesBg('#ffffff', 0.04)}>
      <div className="container-page grid grid-cols-1 gap-12 py-16 lg:grid-cols-12 lg:gap-16 lg:py-20">
        <div className="lg:col-span-6">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-sun-200 uppercase">
            <Building2 aria-hidden className="size-4" /> Para instituições
          </p>
          <h2 id="instituicoes-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold text-white sm:text-5xl">
            Gere um lar? Preencha vagas <em>mais depressa.</em>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-pine-100">
            Atualize as vagas num toque e receba pedidos já com o perfil de cuidados de cada pessoa. Menos telefonemas a perguntar «há
            vaga?», mais tempo para quem lá vive.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/para-lares" variant="accent" size="lg">
              Como funciona para instituições
            </ButtonLink>
            <ButtonLink to="/registar?tipo=lar" size="lg" className="border-2 border-white/30 bg-transparent text-white shadow-none hover:bg-white/10">
              Registar instituição
            </ButtonLink>
          </div>
        </div>
        <dl className="flex flex-col divide-y divide-white/12 border-y border-white/12 lg:col-span-5 lg:col-start-8">
          {factos.map((f) => (
            <div key={f.texto} className="flex flex-col-reverse gap-1 py-5 sm:flex-row-reverse sm:items-baseline sm:justify-end sm:gap-6">
              <dt className="text-pine-200 sm:max-w-xs">{f.texto}</dt>
              <dd className="font-display text-4xl leading-none font-semibold text-white tabular sm:w-40 sm:shrink-0">{f.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
