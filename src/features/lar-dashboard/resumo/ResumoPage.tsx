import type { Candidatura, Lar, User } from '@/types'
import { Reveal } from '@/components/ui/Reveal'
import type { NumerosResumo } from '../lib/derive'
import { AttentionList } from './AttentionList'
import { Freshness } from './Freshness'
import { Kpis } from './Kpis'
import { MiniForecast } from './MiniForecast'
import { OnboardingChecklist } from './OnboardingChecklist'
import { VagaLibertadaPanel } from './VagaLibertadaPanel'

/** /gestao — o dia da casa numa página: confirmar vagas, os números, o que espera por si e o atalho de saída. */
export default function ResumoPage({ lar, cands, user, n }: { lar: Lar; cands: Candidatura[]; user: User | null; n: NumerosResumo }) {
  return (
    <div className="flex flex-col gap-14 lg:gap-20">
      <OnboardingChecklist lar={lar} user={user} />
      <Freshness lar={lar} />
      <Kpis lar={lar} n={n} />
      <div className="grid items-start gap-14 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:gap-12">
        <Reveal>
          <AttentionList lar={lar} cands={cands} />
        </Reveal>
        <div className="flex flex-col gap-12">
          <Reveal delay={80}>
            <VagaLibertadaPanel lar={lar} />
          </Reveal>
          <Reveal delay={160}>
            <MiniForecast lar={lar} />
          </Reveal>
        </div>
      </div>
    </div>
  )
}
