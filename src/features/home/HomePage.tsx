import { useMemo } from 'react'
import { useLares } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Hero } from './Hero'
import { Numbers } from './Numbers'
import { Bento } from './Bento'
import { ComVagaSection } from './ComVagaSection'
import { InstitutionsCta } from './InstitutionsCta'
import { FaqSection } from './FaqSection'
import { calcularStats } from './homeData'
import { useNow } from './useNow'

/**
 * Página inicial, ao estilo Apple: seis secções, uma ideia cada.
 * Pesquisa → números → o que o produto faz → vagas de hoje → instituições → dúvidas.
 */
export default function HomePage() {
  useDocumentTitle(undefined)
  const lares = useLares()
  const agora = useNow()
  const stats = useMemo(() => calcularStats(lares), [lares])

  return (
    <div className="flex flex-col">
      <Hero lares={lares} agora={agora} comVaga={stats.comVaga} />
      <Numbers stats={stats} />
      <Bento lares={lares} stats={stats} agora={agora} />
      <ComVagaSection lares={lares} />
      <InstitutionsCta />
      <FaqSection />
    </div>
  )
}
