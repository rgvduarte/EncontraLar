import { useMemo } from 'react'
import { useLares } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Hero } from './Hero'
import { Contexto } from './Contexto'
import { ComoFunciona } from './ComoFunciona'
import { Bento } from './Bento'
import { ComVagaSection } from './ComVagaSection'
import { InstitutionsCta } from './InstitutionsCta'
import { FaqSection } from './FaqSection'
import { calcularStats } from './homeData'
import { useNow } from './useNow'

/**
 * Página inicial, ao estilo Apple: uma história em cinco tempos, uma ideia por secção.
 * 1. Gancho (pesquisa + mapa que se acende) → 2. Contexto (frase que se acende + números) →
 * 3. Percurso ("Como funciona", cena presa no desktop) → 4. Clímax (grelha que se monta) →
 * 5. Desfecho (vagas de hoje em galeria horizontal, instituições, dúvidas).
 */
export default function HomePage() {
  useDocumentTitle(undefined)
  const lares = useLares()
  const agora = useNow()
  const stats = useMemo(() => calcularStats(lares), [lares])

  return (
    <div className="flex flex-col">
      <Hero lares={lares} agora={agora} comVaga={stats.comVaga} />
      <Contexto stats={stats} />
      <ComoFunciona lares={lares} agora={agora} />
      <Bento lares={lares} stats={stats} agora={agora} />
      <ComVagaSection lares={lares} />
      <InstitutionsCta />
      <FaqSection />
    </div>
  )
}
