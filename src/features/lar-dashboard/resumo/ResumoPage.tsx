import type { Candidatura, Lar, User } from '@/types'
import { Reveal } from '@/components/motion'
import type { NumerosResumo } from '../lib/derive'
import { AttentionList } from './AttentionList'
import { EntradasCard } from './EntradasCard'
import { Freshness } from './Freshness'
import { Kpis } from './Kpis'
import { MiniForecast } from './MiniForecast'
import { OnboardingChecklist } from './OnboardingChecklist'
import { VagaLibertadaPanel } from './VagaLibertadaPanel'

/**
 * /gestao — o dia da casa numa página: confirmar vagas, os números, o que espera por si e o atalho de saída.
 * Cada bloco entra como uma pequena cena: o cartão das vagas cresce, os números contam em cascata,
 * os assuntos aparecem um a um e os painéis da direita surgem do desfoque.
 */
export default function ResumoPage({ lar, cands, user, n }: { lar: Lar; cands: Candidatura[]; user: User | null; n: NumerosResumo }) {
  return (
    <div className="flex flex-col gap-12 sm:gap-14 lg:gap-20">
      <OnboardingChecklist lar={lar} user={user} />
      <Reveal variant="scale" duration={900}>
        <Freshness lar={lar} />
      </Reveal>
      <Kpis lar={lar} n={n} />
      <div className="grid items-start gap-12 sm:gap-14 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-12">
        <AttentionList lar={lar} cands={cands} />
        <div className="flex flex-col gap-12">
          <Reveal variant="blur" delay={40}>
            <EntradasCard cands={cands} />
          </Reveal>
          <Reveal variant="blur" delay={80}>
            <VagaLibertadaPanel lar={lar} />
          </Reveal>
          <Reveal variant="blur" delay={160}>
            <MiniForecast lar={lar} />
          </Reveal>
        </div>
      </div>
    </div>
  )
}
