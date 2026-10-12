import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Reveal } from '@/components/ui/Reveal'
import { useCurrentUser, useFavoritos, useNotificacoes } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { usePedidos, usePerfisOrdenados, pesquisaUrl, visitasFuturas } from '../shared/data'
import { VagaProposta } from '../shared/VagaProposta'
import { primeiroNome } from '../shared/text'
import { PedidosResumo } from './PedidosResumo'
import { ProximaVisita } from './ProximaVisita'
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
    <div className="flex flex-col gap-16 sm:gap-20">
      {bemvindo && (
        <WelcomeCard
          nome={primeiroNome(user.nome)}
          temPerfil={Boolean(principal)}
          pesquisa={pesquisa}
          onClose={() => {
            const next = new URLSearchParams(params)
            next.delete('bemvindo')
            setParams(next, { replace: true })
          }}
        />
      )}

      {propostas.length > 0 && (
        <div className="flex flex-col gap-6">
          {propostas.map((p, i) => (
            <div key={p.c.id} id={i === 0 ? 'vaga-proposta' : undefined} className="scroll-mt-40">
              <VagaProposta c={p.c} lar={p.lar} />
            </div>
          ))}
        </div>
      )}

      <Reveal>
        <PedidosResumo ativos={ativos} terminados={terminados.length} pesquisa={pesquisa} />
      </Reveal>

      <Reveal>
        <ProximaVisita visita={visitas[0]} outras={visitas.length - 1} temPedidos={ativos.length > 0} />
      </Reveal>

      <Reveal>
        <Sugestoes perfil={principal} excluir={excluir} />
      </Reveal>

      <div className="grid gap-16 xl:grid-cols-2 xl:gap-12">
        <Reveal>
          <Novidades notifs={notifs} />
        </Reveal>
        <Reveal delay={120}>
          <ProximosPassos perfil={principal} guardados={favoritos.length} pedidos={todos.length} visita={visitas[0]} pesquisa={pesquisa} />
        </Reveal>
      </div>
    </div>
  )
}
