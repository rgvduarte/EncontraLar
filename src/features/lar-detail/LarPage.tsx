import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { setAlerta, toggleFavorito, useAcesso, useCurrentUser, useFavorito, useLar, useMinhasCandidaturas } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { AcessoNecessarioModal, type AcaoAcesso } from '@/components/acesso'
import { useDocumentTitle } from '@/lib/hooks'
import { caminhoFicha, dividirNome, oLar, useDadosLar } from './helpers'
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

/** Ações pagas da ficha que, na versão grátis, abrem a folha do Acesso Família. */
type AcaoFicha = Extract<AcaoAcesso, 'pedir' | 'visita' | 'alerta'>

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

/**
 * Duas vistas, com o portão `useAcesso().completo` (docs/MODELO-NEGOCIO.md, Acesso Família):
 * - completa (famílias com passe, profissionais de saúde): vagas, preços por quarto, previsão, contactos, pedidos;
 * - grátis (visitantes, famílias sem passe, instituições): genérica — faixa de preço, avaliação geral, zona — com os
 *   bloqueios padrão. Os valores fechados não chegam ao DOM; "Pedir vaga", "Marcar visita" e o alerta abrem a folha
 *   do Acesso Família, que volta a esta ficha com `?acao=` para retomar o pedido depois de ativar o passe.
 */
function Ficha({ lar }: { lar: Lar }) {
  useDocumentTitle(lar.nome)
  const dados = useDadosLar(lar)
  const user = useCurrentUser()
  const { completo } = useAcesso()
  const minhas = useMinhasCandidaturas()
  const ativa = useMemo(() => (user?.role === 'familia' ? pedidoDaFamilia(minhas, lar.id) : undefined), [user, minhas, lar.id])
  const minhaFicha = user?.role === 'lar' && user.larId === lar.id
  // serviço social: "Pedir vaga" abre a escolha de um caso (PedidoModal); não marca visitas pela família
  const profissional = user?.role === 'profissional'

  const [pedido, setPedido] = useState({ n: 0, aberto: false, visita: false })
  const abrirPedido = (visita: boolean) => setPedido((p) => ({ n: p.n + 1, aberto: true, visita }))
  const [visitaDe, setVisitaDe] = useState<Candidatura | null>(null)

  // versão grátis: as ações pagas explicam o Acesso Família (instituições: só a nota, sem convite)
  const [bloqueio, setBloqueio] = useState<{ acao: AcaoFicha; aberto: boolean }>({ acao: 'pedir', aberto: false })
  const pedirAcesso = (acao: AcaoAcesso) => {
    if (acao === 'pedir' || acao === 'visita' || acao === 'alerta') setBloqueio({ acao, aberto: true })
  }
  const pedir = (visita: boolean) => (completo ? abrirPedido(visita) : pedirAcesso(visita ? 'visita' : 'pedir'))
  const visitaNoPedido = (c: Candidatura) => (completo ? setVisitaDe(c) : pedirAcesso('visita'))

  useRetomarIntencao(lar, ativa, completo, abrirPedido, setVisitaDe)

  // barra fixa no telemóvel: só quando as ações do cartão não estão à vista e ainda não chegámos ao fim da ficha
  const ctaRef = useRef<HTMLDivElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const ctaVisivel = useInView(ctaRef, '0px', `${completo ? 'completo' : 'gratis'}-${ativa ? ativa.id : minhaFicha ? 'gestor' : 'livre'}`)
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
            <LarHero lar={lar} completo={completo} />
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
                  completo={completo}
                  profissional={profissional}
                  ctaRef={ctaRef}
                  onPedir={() => pedir(false)}
                  onVisita={() => pedir(true)}
                  onVisitaExistente={visitaNoPedido}
                  onAcesso={pedirAcesso}
                />
              </Reveal>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-28 pt-10 sm:gap-36 sm:pt-20 lg:col-start-1 lg:row-start-2">
            <SobreSection lar={lar} dados={dados} />
            <CuidadosSection lar={lar} />
            <PrecosSection lar={lar} dados={dados} completo={completo} />
            <PrevisaoSection lar={lar} dados={dados} completo={completo} />
            <TransparenciaSection lar={lar} completo={completo} />
            <AvaliacoesSection lar={lar} completo={completo} />
            <LocalizacaoSection lar={lar} completo={completo} />
          </div>
        </div>
      </div>

      <SemelhantesSection lar={lar} completo={completo} />
      <div ref={fimRef} aria-hidden className="h-px" />

      <MobileActionBar
        lar={lar}
        dados={dados}
        ativa={ativa}
        minhaFicha={minhaFicha}
        completo={completo}
        profissional={profissional}
        visivel={!ctaVisivel && !fimVisivel}
        onPedir={() => pedir(false)}
        onVisita={() => pedir(true)}
      />

      {/* o pedido e a visita só abrem com acesso completo (na versão grátis abre a folha do Acesso Família) */}
      <PedidoModal
        key={pedido.n}
        lar={lar}
        open={pedido.aberto && completo}
        comVisita={pedido.visita}
        onClose={() => setPedido((p) => ({ ...p, aberto: false }))}
      />
      <VisitaModal key={visitaDe?.id ?? 'nenhuma'} lar={lar} c={visitaDe} open={Boolean(visitaDe) && completo} onClose={() => setVisitaDe(null)} />
      {!completo && (
        <AcessoNecessarioModal
          open={bloqueio.aberto}
          onClose={() => setBloqueio((b) => ({ ...b, aberto: false }))}
          acao={bloqueio.acao}
          // depois de ativar, volta aqui com a intenção (?acao=pedir|visita|alerta), que esta ficha retoma
          voltar={`${caminhoFicha(lar)}?acao=${bloqueio.acao}`}
        />
      )}
    </div>
  )
}

/**
 * Retoma o que a pessoa estava a fazer quando teve de entrar, criar conta ou ativar o Acesso Família:
 * o regresso traz `?acao=pedir|visita|alerta` (pedido, visita, alerta de vaga) ou `?guardar=<id>` (coração).
 * Aplica-se uma vez, já com sessão, e tira-se do URL (replace) para não repetir ao recarregar ou voltar atrás.
 * Idempotente: se o alerta ou o favorito já foram aplicados no início de sessão, não faz nada nem repete o aviso.
 * O pedido, a visita e o alerta são do Acesso Família: sem acesso completo (ex.: voltou da página do passe sem o
 * ativar) a intenção sai do URL sem abrir nada — a ficha já mostra onde está cada coisa, sem insistir.
 * Guardar é livre e retoma-se sempre.
 */
function useRetomarIntencao(
  lar: Lar,
  ativa: Candidatura | undefined,
  completo: boolean,
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

    if (completo && (acao === 'pedir' || acao === 'visita')) {
      const visita = acao === 'visita'
      // já há pedido ativo: a visita marca-se nesse pedido (como no cartão), em vez de abrir um pedido novo
      const podeVisitar = ativa && !ativa.visita && ['enviada', 'em_analise', 'lista_espera'].includes(ativa.estado)
      if (visita && podeVisitar) abrirVisita(ativa)
      // a folha trata o resto: perfis com pedido ativo e contas de serviço social (casos)
      else abrirPedido(visita)
    } else if (completo && acao === 'alerta' && user.role === 'familia' && !fav?.alerta) {
      setAlerta(lar.id, true)
      toast.success('Alerta de vaga ativado', `Avisamos assim que ${oLar(lar.nome)} indicar um lugar livre.`)
    }
    if (guardar === lar.id && user.role === 'familia' && !fav) {
      toggleFavorito(lar.id)
      // os alertas de vaga são do Acesso Família: sem ele, não se promete o aviso
      toast.success('Guardado nos seus favoritos', completo ? 'Vamos avisá-lo(a) quando houver vaga.' : 'Fica nos guardados do seu painel.')
    }

    setParams(
      (p) => {
        p.delete('acao')
        p.delete('guardar')
        return p
      },
      { replace: true },
    )
  }, [user, completo, acao, guardar, fav, ativa, lar, abrirPedido, abrirVisita, setParams])
}
