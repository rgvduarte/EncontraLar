import type { Candidatura, Lar, User } from '@/types'
import type { NumerosResumo } from '../lib/derive'
import { AttentionList } from './AttentionList'
import { FreshnessBoard } from './FreshnessBoard'
import { KpiLedger } from './KpiLedger'
import { MiniForecast } from './MiniForecast'
import { OnboardingChecklist } from './OnboardingChecklist'
import { VagaLibertadaPanel } from './VagaLibertadaPanel'

/** /gestao — o dia da instituição numa página: frescura das vagas, números, agenda e atalhos. */
export default function ResumoPage({ lar, cands, user, n }: { lar: Lar; cands: Candidatura[]; user: User | null; n: NumerosResumo }) {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <OnboardingChecklist lar={lar} user={user} />
      <FreshnessBoard lar={lar} />
      {/* no telemóvel, as ações vêm antes dos números */}
      <div className="order-last lg:order-none">
        <KpiLedger lar={lar} n={n} />
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <AttentionList lar={lar} cands={cands} />
        <div className="flex flex-col gap-6">
          <VagaLibertadaPanel lar={lar} />
          <MiniForecast lar={lar} />
        </div>
      </div>
    </div>
  )
}
