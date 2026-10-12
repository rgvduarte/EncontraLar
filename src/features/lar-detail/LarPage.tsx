import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { useCurrentUser, useLar, useMinhasCandidaturas } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { useDadosLar } from './helpers'
import { useInView, useStickyTop } from './hooks'
import { LarNotFound } from './LarNotFound'
import { Breadcrumbs, LarHero } from './LarHero'
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

  const [pedido, setPedido] = useState({ n: 0, aberto: false, visita: false })
  const abrirPedido = (visita: boolean) => setPedido((p) => ({ n: p.n + 1, aberto: true, visita }))
  const [visitaDe, setVisitaDe] = useState<Candidatura | null>(null)

  // barra fixa no telemóvel: só quando o cartão de vagas não está à vista e ainda não chegámos ao fim da ficha
  const ctaRef = useRef<HTMLDivElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)
  const ctaVisivel = useInView(ctaRef)
  const fimVisivel = useInView(fimRef)
  const cartaoRef = useRef<HTMLDivElement>(null)
  const topoCartao = useStickyTop(cartaoRef)

  return (
    <div className="relative isolate overflow-clip">
      <div className="container-page pt-5 sm:pt-7">
        <Breadcrumbs lar={lar} />
        <div className="mt-5 grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-x-14">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <LarHero lar={lar} dados={dados} />
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <SectionNav />
            <div className="mt-12 flex flex-col gap-24">
              <SobreSection lar={lar} dados={dados} numero={1} />
              <CuidadosSection lar={lar} numero={2} />
              <PrecosSection lar={lar} dados={dados} numero={3} />
              <PrevisaoSection lar={lar} dados={dados} numero={4} />
              <TransparenciaSection lar={lar} numero={5} />
              <AvaliacoesSection lar={lar} numero={6} />
              <LocalizacaoSection lar={lar} numero={7} />
            </div>
          </div>
        </div>
      </div>

      <SemelhantesSection lar={lar} />
      <div ref={fimRef} aria-hidden className="h-px" />

      <MobileActionBar lar={lar} dados={dados} ativa={ativa} visivel={!ctaVisivel && !fimVisivel} onPedir={() => abrirPedido(false)} />

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
