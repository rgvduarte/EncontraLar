import { useCurrentUser, useLares, usePerfis } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { PASSOS, TOTAL_PASSOS } from './model'
import { temProgresso, useMatchSession } from './useMatchSession'
import { StartScreen } from './wizard/StartScreen'
import { Wizard } from './wizard/Wizard'
import { ResultsView } from './results/ResultsView'

/**
 * /encontrar — "Ajuda-me a escolher": questionário de 6 passos (perfil clínico) → sugestões ordenadas e explicadas.
 * Estado no sessionStorage (um refresh não perde nada); guardar na conta é uma decisão explícita da família.
 */
export default function MatchPage() {
  const [sessao, acoes] = useMatchSession()
  const lares = useLares()
  const user = useCurrentUser()
  const perfis = usePerfis()

  useDocumentTitle(
    sessao.vista === 'passos'
      ? `Passo ${sessao.passo + 1} de ${TOTAL_PASSOS}: ${PASSOS[sessao.passo]!.nome} · Ajuda-me a escolher`
      : sessao.vista === 'resultados'
        ? 'Sugestões · Ajuda-me a escolher'
        : 'Ajuda-me a escolher',
  )

  if (sessao.vista === 'passos') return <Wizard sessao={sessao} acoes={acoes} lares={lares} />
  if (sessao.vista === 'resultados') return <ResultsView sessao={sessao} acoes={acoes} lares={lares} user={user} />
  return (
    <StartScreen
      sessao={sessao}
      acoes={acoes}
      lares={lares}
      perfis={user?.role === 'familia' ? perfis : []}
      emCurso={temProgresso(sessao)}
    />
  )
}
