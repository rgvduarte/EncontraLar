import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { VagasBoard } from '@/components/brand/VagasBoard'
import { CalcadaDivider, calcadaStonesBg } from '@/components/brand/patterns'
import { pct } from '@/lib/format'
import type { HomeStats } from './homeData'

const PINE_900 = '#163a37'
const CREAM = '#fbf8f3'

/** Secção escura: o quadro de vagas como prova de que as vagas são reais. */
export function VagasReaisSection({ lares, stats }: { lares: Lar[]; stats: HomeStats }) {
  const fracaoSemana = stats.total ? stats.atualizadasSemana / stats.total : 0
  return (
    <section aria-labelledby="vagas-reais-titulo" className="on-dark relative">
      <CalcadaDivider color={PINE_900} bg={CREAM} height={26} />
      <div className="bg-pine-900 text-pine-50" style={calcadaStonesBg('#ffffff', 0.03)}>
        <div className="container-page grid grid-cols-1 gap-12 py-16 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <div className="flex flex-col lg:col-span-5">
            <p className="text-xs font-bold tracking-[0.16em] text-sun-200 uppercase">Quadro de vagas</p>
            <h2 id="vagas-reais-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold text-white sm:text-5xl">
              Vagas reais, <em>não promessas.</em>
            </h2>
            <p className="mt-6 text-lg text-pine-100">
              Cada vaga que vê aqui foi indicada pela própria instituição, no painel de gestão. Quando um quarto fica livre, a direção
              técnica atualiza-o com um toque — e as famílias em lista de espera ou que seguem esse lar recebem um aviso no mesmo
              momento.
            </p>
            <p className="mt-4 text-lg text-pine-100">Sem telefonemas para saber «se há vaga». Sem listas que ninguém atualiza.</p>

            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-white/15 pt-8">
              <div className="flex flex-col gap-2">
                <dt className="order-last text-sm leading-snug text-pine-200">das fichas confirmaram as vagas nos últimos 7 dias</dt>
                <dd className="font-display text-5xl leading-none font-semibold text-sun-200 tabular">{pct(fracaoSemana)}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="order-last text-sm leading-snug text-pine-200">instituições visitadas pela nossa equipa, com selo Verificado</dt>
                <dd className="font-display text-5xl leading-none font-semibold text-white tabular">{stats.verificadas}</dd>
              </div>
            </dl>

            <Link
              to="/pesquisa?vaga=agora"
              className="group mt-10 inline-flex min-h-12 items-center gap-2 self-start text-lg font-bold text-white underline decoration-terra-300 decoration-2 underline-offset-8 hover:decoration-white"
            >
              Ver as {stats.comVaga} instituições com vaga no mapa
              <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="lg:col-span-7 lg:pt-4">
            <VagasBoard lares={lares} linhas={7} titulo="Vagas atualizadas agora" className="ring-white/10" />
            <p className="mt-4 text-sm text-pine-200">
              O quadro roda devagar com as atualizações mais recentes. Cada linha abre a ficha da instituição.
            </p>
          </div>
        </div>
      </div>
      <CalcadaDivider color={CREAM} bg={PINE_900} height={26} />
    </section>
  )
}
