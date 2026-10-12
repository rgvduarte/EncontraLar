import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { setAlerta, toggleFavorito, useCurrentUser, useFavorito, useLar, useMinhasCandidaturas } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { useDocumentTitle } from '@/lib/hooks'
import { dividirNome, oLar, useDadosLar } from './helpers'
import { useInView, useJaPassou, useStickyTop } from './hooks'
import { LarNotFound } from './LarNotFound'
import { Breadcrumbs, LarCapa, LarHero } from './LarHero'
import { VagasCard } from './VagasCard'
import { SectionNav } from './SectionNav'
import { MobileActionBar } from './MobileActionBar'
import { SemelhantesSection } from './SemelhantesSection'
import { SobreSection } from './sections/SobreSection'
import { CuidadosSection } from './sections/CuidadosSection'
import { PrecosSection } from './sections/PrecosSection'
import { PrevisaoSection } from './sections/PrevisaoSection'
import { TransparenciaSection } from './sections/TransparenciaSection'
import { AvaliacoesSection } from './sections/AvaliacoesSection'
import { LocalizacaoSection } from './sections/LocalizacaoSection'
import { PedidoModal } from './pedido/PedidoModal'
import { VisitaModal } from './pedido/VisitaModal'
import { Reveal } from '@/components/motion'
import './ficha.css'

const ATIVOS: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite']

/**
 * Pedido da família a mostrar no cartão (em vez de "Pedir vaga"): um pedido em curso tem prioridade;
 * sem nenhum, a entrada já registada ('admitida') — "Entrou a <dia>", confirmar a entrada, avaliar.
 */
function pedidoDaFamilia(minhas: Candidatura[], larId: string): Candidatura | undefined {
  const aqui = minhas.filter((c) => c.larId === larId)
  return aqui.find((c) => ATIVOS.includes(c.estado)) ?? aqui.find((c) => c.estado === 'admitida')
}

/** Ficha da instituição — /lar/:id */
export default function LarPage() {
  const { id } = useParams()
  const lar = useLar(id)
  if (!lar) return <LarNotFound />
  return <Ficha key={lar.id} lar={lar} />
}

function Ficha({ lar }: { lar: Lar }) {
  useDocumentTitle(lar.nome)
  const dados = useDadosLar(lar)
  const user = useCurrentUser()
  const minhas = useMinhasCandidaturas()
  const ativa = useMemo(() => (user?.role === 'familia' ? pedidoDaFamilia(minhas, lar.id) : undefined), [user, minhas, lar.id])
  const minhaFicha = user?.role === 'lar' && user.larId === lar.id
  // serviço social: "Pedir vaga" abre a escolha de um caso (PedidoModal); não marca visitas pela família
  const profissional = user?.role === 'profissional'

  const [pedido, setPedido] = useState({ n: 0, aberto: false, visita: false })
  const abrirPedido = (visita: boolean) => setPedido((p) => ({ n: p.n + 1, aberto: true, visita }))
  const [visitaDe, setVisitaDe] = useState<Candidatura | null>(null)
  useRetomarIntencao(lar, ativa, abrirPedido, setVisitaDe)

  // barra fixa no telemóvel: só quando as ações do cartão não estão à vista e ainda não chegámos ao fim da ficha
  const ctaRef = useRef<HTMLDivElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const ctaVisivel = useInView(ctaRef, '0px', ativa ? ativa.id : minhaFicha ? 'gestor' : 'livre')
  // a barra some antes de o último conteúdo entrar no ecrã (margem ≥ espaço inferior da página) e não volta no rodapé
  const fimVisivel = useJaPassou(fimRef, 128)
  const cartaoRef = useRef<HTMLDivElement>(null)
  const topoCartao = useStickyTop(cartaoRef)

  return (
    <div className="relative isolate overflow-clip">
      <SectionNav nome={dividirNome(lar.nome).nucleo} />

      {/* no telemóvel/tablet o fundo reserva espaço para a barra de ação fixa */}
      <div className="container-page pt-2 pb-28 sm:pt-6 sm:pb-32 lg:pb-40">
        <Breadcrumbs lar={lar} />
        <div className="mt-3 grid sm:mt-6 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-x-20">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <LarHero lar={lar} />
            <div className="mt-7 sm:mt-10">
              <LarCapa lar={lar} />
            </div>
          </div>

          <aside aria-label="Preço, vagas e pedido" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div ref={cartaoRef} className="lg:sticky" style={{ top: topoCartao }}>
              <Reveal variant="up" delay={320} duration={1100}>
                <VagasCard
                  lar={lar}
                  dados={dados}
                  ativa={ativa}
                  profissional={profissional}
                  ctaRef={ctaRef}
                  onPedir={() => abrirPedido(false)}
                  onVisita={() => abrirPedido(true)}
                  onVisitaExistente={setVisitaDe}
                />
              </Reveal>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-28 pt-10 sm:gap-36 sm:pt-20 lg:col-start-1 lg:row-start-2">
            <SobreSection lar={lar} dados={dados} />
            <CuidadosSection lar={lar} />
            <PrecosSection lar={lar} dados={dados} />
            <PrevisaoSection lar={lar} dados={dados} />
            <TransparenciaSection lar={lar} />
            <AvaliacoesSection lar={lar} />
            <LocalizacaoSection lar={lar} />
          </div>
        </div>
      </div>

      <SemelhantesSection lar={lar} />
      <div ref={fimRef} aria-hidden className="h-px" />

      <MobileActionBar
        lar={lar}
        dados={dados}
        ativa={ativa}
        minhaFicha={minhaFicha}
        profissional={profissional}
        visivel={!ctaVisivel && !fimVisivel}
        onPedir={() => abrirPedido(false)}
        onVisita={() => abrirPedido(true)}
      />

      <PedidoModal
        key={pedido.n}
        lar={lar}
        open={pedido.aberto}
        comVisita={pedido.visita}
        onClose={() => setPedido((p) => ({ ...p, aberto: false }))}
      />
      <VisitaModal key={visitaDe?.id ?? 'nenhuma'} lar={lar} c={visitaDe} open={Boolean(visitaDe)} onClose={() => setVisitaDe(null)} />
    </div>
  )
}

/**
 * Retoma o que a pessoa estava a fazer quando teve de entrar ou criar conta (ux-intuitive-2):
 * o regresso traz `?acao=pedir|visita|alerta` (pedido, visita, alerta de vaga) ou `?guardar=<id>` (coração).
 * Aplica-se uma vez, já com sessão, e tira-se do URL (replace) para não repetir ao recarregar ou voltar atrás.
 * Idempotente: se o alerta ou o favorito já foram aplicados no início de sessão, não faz nada nem repete o aviso.
 */
function useRetomarIntencao(
  lar: Lar,
  ativa: Candidatura | undefined,
  abrirPedido: (visita: boolean) => void,
  abrirVisita: (c: Candidatura) => void,
) {
  const user = useCurrentUser()
  const fav = useFavorito(lar.id)
  const [params, setParams] = useSearchParams()
  const acao = params.get('acao')
  const guardar = params.get('guardar')
  const tratada = useRef<string | null>(null)

  useEffect(() => {
    // sem sessão ainda (ex.: a sessão está a ser reposta): espera, a intenção fica no URL
    if (!user || (!acao && !guardar)) return
    const chave = `${acao}|${guardar}`
    if (tratada.current === chave) return // StrictMode / novo render antes de o URL mudar
    tratada.current = chave

    if (acao === 'pedir' || acao === 'visita') {
      const visita = acao === 'visita'
      // já há pedido ativo: a visita marca-se nesse pedido (como no cartão), em vez de abrir um pedido novo
      const podeVisitar = ativa && !ativa.visita && ['enviada', 'em_analise', 'lista_espera'].includes(ativa.estado)
      if (visita && podeVisitar) abrirVisita(ativa)
      // a folha trata o resto: perfis com pedido ativo, e contas de instituição ("só para famílias")
      else abrirPedido(visita)
    } else if (acao === 'alerta' && user.role === 'familia' && !fav?.alerta) {
      setAlerta(lar.id, true)
      toast.success('Alerta de vaga ativado', `Avisamos assim que ${oLar(lar.nome)} indicar um lugar livre.`)
    }
    if (guardar === lar.id && user.role === 'familia' && !fav) {
      toggleFavorito(lar.id)
      toast.success('Guardado nos seus favoritos', 'Vamos avisá-lo(a) quando houver vaga.')
    }

    setParams(
      (p) => {
        p.delete('acao')
        p.delete('guardar')
        return p
      },
      { replace: true },
    )
  }, [user, acao, guardar, fav, ativa, lar, abrirPedido, abrirVisita, setParams])
}
