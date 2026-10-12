import { useMemo } from 'react'
import { useLares } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Hero } from './Hero'
import { VagasReaisSection } from './VagasReaisSection'
import { ForecastSection } from './ForecastSection'
import { ComVagaSection } from './ComVagaSection'
import { HowItWorks } from './HowItWorks'
import { TransparencySection } from './TransparencySection'
import { RegionIndex } from './RegionIndex'
import { EmpathyBand } from './EmpathyBand'
import { InstitutionsBand } from './InstitutionsBand'
import { FaqSection } from './FaqSection'
import { calcularStats, escolherFichaExemplo, escolherPrevisao } from './homeData'
import { useNow } from './useNow'

/**
 * Página inicial. Em 5 segundos: onde há vaga agora, quanto custa e quando é provável haver vaga —
 * e um caminho direto para começar a procurar.
 */
export default function HomePage() {
  useDocumentTitle(undefined)
  const lares = useLares()
  const agora = useNow()
  const stats = useMemo(() => calcularStats(lares, agora), [lares, agora])
  const previsao = useMemo(() => escolherPrevisao(lares), [lares])
  const ficha = useMemo(() => escolherFichaExemplo(lares), [lares])

  return (
    <div className="flex flex-col">
      <Hero lares={lares} stats={stats} agora={agora} />
      <VagasReaisSection lares={lares} stats={stats} />
      <ForecastSection previsao={previsao} agora={agora} />
      <ComVagaSection lares={lares} />
      <HowItWorks lares={lares} previsao={previsao} />
      <TransparencySection lar={ficha} agora={agora} />
      <RegionIndex lares={lares} />
      <EmpathyBand />
      <InstitutionsBand stats={stats} />
      <FaqSection />
    </div>
  )
}
