import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { useCurrentUser, useLar, useMinhasCandidaturas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { dividirNome, useDadosLar } from './helpers'
import { useInView, useStickyTop } from './hooks'
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

const ATIVOS: Candidatura['estado'][] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite']

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
  const ativa = useMemo(
    () => (user?.role === 'familia' ? minhas.find((c) => c.larId === lar.id && ATIVOS.includes(c.estado)) : undefined),
    [user, minhas, lar.id],
  )
  const minhaFicha = user?.role === 'lar' && user.larId === lar.id

  const [pedido, setPedido] = useState({ n: 0, aberto: false, visita: false })
  const abrirPedido = (visita: boolean) => setPedido((p) => ({ n: p.n + 1, aberto: true, visita }))
  const [visitaDe, setVisitaDe] = useState<Candidatura | null>(null)

  // barra fixa no telemóvel: só quando as ações do cartão não estão à vista e ainda não chegámos ao fim da ficha
  const ctaRef = useRef<HTMLDivElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const ctaVisivel = useInView(ctaRef)
  const fimVisivel = useInView(fimRef)
  const cartaoRef = useRef<HTMLDivElement>(null)
  const topoCartao = useStickyTop(cartaoRef)

  return (
    <div className="relative isolate overflow-clip">
      <SectionNav nome={dividirNome(lar.nome).nucleo} />

      <div className="container-page pt-4 pb-24 sm:pt-6 sm:pb-32 lg:pb-40">
        <Breadcrumbs lar={lar} />
        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-x-20">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <LarHero lar={lar} />
            <div className="mt-10">
              <LarCapa lar={lar} />
            </div>
          </div>

          <aside aria-label="Preço, vagas e pedido" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div ref={cartaoRef} className="lg:sticky" style={{ top: topoCartao }}>
              <VagasCard
                lar={lar}
                dados={dados}
                ativa={ativa}
                ctaRef={ctaRef}
                onPedir={() => abrirPedido(false)}
                onVisita={() => abrirPedido(true)}
                onVisitaExistente={setVisitaDe}
              />
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-24 pt-14 sm:gap-32 sm:pt-20 lg:col-start-1 lg:row-start-2">
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
        visivel={!ctaVisivel && !fimVisivel}
        onPedir={() => abrirPedido(false)}
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
