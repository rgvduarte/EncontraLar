import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useCurrentUser, useFavoritos, useNotificacoes } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { usePedidos, usePerfisOrdenados, pesquisaUrl, visitasFuturas } from '../shared/data'
import { VagaProposta } from '../shared/VagaProposta'
import { Enter } from '../shared/motion'
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
          {/* o momento-chave entra com escala (estilo Apple) */}
          {propostas.map((p, i) => (
            <Enter key={p.c.id} id={i === 0 ? 'vaga-proposta' : undefined} variant="scale" duration={900} delay={i * 90} className="scroll-mt-40">
              <VagaProposta c={p.c} lar={p.lar} thumbBar={i === 0} />
            </Enter>
          ))}
        </div>
      )}

      {/* sem perfil, o primeiro passo é descrevê-lo: vem antes de tudo */}
      {!principal && !bemvindo && (
        <Enter>
          <Sugestoes perfil={principal} excluir={excluir} />
        </Enter>
      )}

      <Enter>
        <PedidosResumo ativos={ativos} terminados={terminados.length} pesquisa={pesquisa} />
      </Enter>

      {(visitas.length > 0 || ativos.length > 0) && (
        <Enter>
          <ProximaVisita visita={visitas[0]} outras={visitas.length - 1} temPedidos={ativos.length > 0} />
        </Enter>
      )}

      {principal && (
        <Enter>
          <Sugestoes perfil={principal} excluir={excluir} />
        </Enter>
      )}

      <div className="grid gap-16 xl:grid-cols-2 xl:gap-12">
        <Enter>
          <Novidades notifs={notifs} />
        </Enter>
        <Enter delay={120}>
          <ProximosPassos perfil={principal} guardados={favoritos.length} pedidos={todos.length} visita={visitas[0]} pesquisa={pesquisa} />
        </Enter>
      </div>
    </div>
  )
}
