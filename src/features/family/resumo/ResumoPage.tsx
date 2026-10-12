import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useCurrentUser, useFavoritos, useNotificacoes } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { usePedidos, usePerfisOrdenados, pesquisaUrl, visitasFuturas } from '../shared/data'
import { VagaProposta } from '../shared/VagaProposta'
import { VisitTicket } from '../shared/VisitTicket'
import { HelpCard } from '../shared/SidebarBits'
import { primeiroNome } from '../shared/text'
import { PedidosResumo } from './PedidosResumo'
import { ProximosPassos } from './ProximosPassos'
import { Novidades } from './Novidades'
import { Sugestoes } from './Sugestoes'
import { WelcomeCard } from './WelcomeCard'

export default function ResumoPage() {
  useDocumentTitle('O meu painel')
  const user = useCurrentUser()!
  const { principal } = usePerfisOrdenados()
  const { ativos, terminados, todos } = usePedidos()
  const favoritos = useFavoritos()
  const notifs = useNotificacoes()
  const [params, setParams] = useSearchParams()
  const bemvindo = params.get('bemvindo') === '1'

  const propostas = ativos.filter((p) => p.c.estado === 'vaga_proposta')
  const visitas = useMemo(() => visitasFuturas(ativos), [ativos])
  const excluir = useMemo(() => new Set(todos.filter((p) => p.c.estado !== 'cancelada').map((p) => p.lar.id)), [todos])
  const pesquisa = principal ? pesquisaUrl(principal) : '/pesquisa'

  return (
    <div className="flex flex-col gap-8">
      {propostas.map((p, i) => (
        <div key={p.c.id} id={i === 0 ? 'vaga-proposta' : undefined} className="scroll-mt-28">
          <VagaProposta c={p.c} lar={p.lar} />
        </div>
      ))}

      {bemvindo && (
        <WelcomeCard
          nome={primeiroNome(user.nome)}
          temPerfil={Boolean(principal)}
          guardados={favoritos.length}
          pedidos={todos.length}
          onClose={() => {
            const next = new URLSearchParams(params)
            next.delete('bemvindo')
            setParams(next, { replace: true })
          }}
        />
      )}

      <div className="grid gap-8 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-7">
          <PedidosResumo ativos={ativos} terminados={terminados.length} />
          <Novidades notifs={notifs} />
        </div>
        <div className="flex min-w-0 flex-col gap-8 xl:col-span-5">
          <VisitTicket visita={visitas[0]} outras={visitas.length - 1} temPedidos={ativos.length > 0} />
          <ProximosPassos perfil={principal} guardados={favoritos.length} visita={visitas[0]} pesquisa={pesquisa} />
        </div>
      </div>

      <Sugestoes perfil={principal} excluir={excluir} />

      <HelpCard className="lg:hidden" />
    </div>
  )
}
