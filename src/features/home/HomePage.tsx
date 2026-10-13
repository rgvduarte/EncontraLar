import { useMemo } from 'react'
import { useAcesso, useLares } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Hero } from './Hero'
import { Contexto } from './Contexto'
import { ComoFunciona } from './ComoFunciona'
import { Bento } from './Bento'
import { ComVagaSection } from './ComVagaSection'
import { AcessoSection } from './AcessoSection'
import { InstitutionsCta } from './InstitutionsCta'
import { FaqSection } from './FaqSection'
import { calcularStats, escolherPrevisao } from './homeData'
import { useNow } from './useNow'

/**
 * Página inicial, ao estilo Apple: uma história em cinco tempos, uma ideia por secção.
 * 1. Gancho (pesquisa + mapa que se acende) → 2. Contexto (frase que se acende + números) →
 * 3. Percurso ("Como funciona", cena presa no desktop) → 4. Clímax (grelha que se monta) →
 * 5. Desfecho (vagas de hoje em galeria horizontal, instituições, dúvidas).
 *
 * O portão é `useAcesso().completo`. Famílias com o Acesso Família e profissionais veem a página de sempre.
 * Na versão grátis (visitantes, famílias sem passe, instituições) a página só diz QUANTAS têm vaga, nunca QUAIS,
 * nem preços exatos: mapa com pontos iguais e etiquetas por distrito, exemplos sem nome na grelha, o "Com vaga
 * agora" sem nomes e, a seguir, o bloco do Acesso Família.
 */
export default function HomePage() {
  useDocumentTitle(undefined)
  const lares = useLares()
  const agora = useNow()
  const { completo } = useAcesso()
  const stats = useMemo(() => calcularStats(lares), [lares])
  // a "história" da previsão (um lar sem vaga hoje, com vaga provável em breve) é usada no percurso e na grelha
  const previsao = useMemo(() => escolherPrevisao(lares), [lares])

  return (
    <div className="flex flex-col">
      <Hero lares={lares} agora={agora} comVaga={stats.comVaga} completo={completo} />
      <Contexto stats={stats} />
      <ComoFunciona lares={lares} agora={agora} previsao={previsao} completo={completo} />
      <Bento lares={lares} stats={stats} agora={agora} previsao={previsao} completo={completo} />
      <ComVagaSection lares={lares} completo={completo} />
      {!completo && <AcessoSection />}
      <InstitutionsCta />
      <FaqSection />
    </div>
  )
}
