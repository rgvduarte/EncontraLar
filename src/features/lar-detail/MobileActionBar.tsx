import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { linkAcesso } from '@/lib/acesso'
import { disponibilidadeTexto } from '@/components/lar/badges'
import { useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'
import { caminhoFicha, ctaPedido, faixaPrecoPartes, pedirGenerico, precoResumo, type DadosLar } from './helpers'
import { acaoDoPedido } from './CandidaturaAtiva'

const PONTO = { disponivel: 'bg-leaf-500', breve: 'bg-sun-500', espera: 'bg-dusk-500' } as const

/** Altura da barra visível, para outros elementos fixos no fundo (ex.: avisos) se poderem afastar. */
const VAR_ALTURA = '--actionbar-h'

/** Preço da linha 1: o exato (com acesso completo) ou só a faixa (versão grátis). */
function PrecoLinha({ lar, completo }: { lar: Lar; completo: boolean }) {
  if (!completo) {
    const { valor, sufixo } = faixaPrecoPartes(lar)
    return (
      <>
        <span className="text-lg font-semibold">{valor}</span>
        {sufixo && <span className="text-sm text-ink-mute">{sufixo}</span>}
      </>
    )
  }
  const preco = precoResumo(lar)
  if (!preco) return <span className="font-semibold">Preço sob consulta</span>
  return (
    <>
      {preco.desde && <span className="text-sm text-ink-mute">desde </span>}
      <span className="text-lg font-semibold tabular">{preco.valor}</span>
      <span className="text-sm text-ink-mute">/mês</span>
    </>
  )
}

/**
 * Barra de ação fixa no fundo (telemóvel/tablet — nesta rota não há barra de abas), ao alcance do polegar:
 * linha 1 = preço e disponibilidade; linha 2 = ação secundária + principal, largas (≥ 52px).
 * Versão grátis: a faixa de preço, nenhuma disponibilidade, e uma só ação — "Ver vagas e preços" (página do Acesso Família).
 * Instituições (role 'lar') não recebem o convite do passe: "Marcar visita" e "Pedir vaga" abrem a folha, que lhes
 * explica que é para famílias (como no cartão).
 * Some quando as ações do cartão estão à vista e no fim da ficha. Respeita a safe area do iPhone.
 * Vai para o <body> num portal: a transição de página aplica transform ao contentor, o que prenderia o
 * `position: fixed` ao fundo do documento em vez do ecrã.
 */
export function MobileActionBar({
  lar,
  dados,
  ativa,
  minhaFicha,
  completo,
  profissional = false,
  visivel,
  onPedir,
  onVisita,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  minhaFicha: boolean
  /** vê a camada completa (useAcesso().completo) */
  completo: boolean
  /** serviço social: só a ação principal (o pedido parte de um caso) */
  profissional?: boolean
  visivel: boolean
  onPedir: () => void
  onVisita: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const role = useCurrentUser()?.role
  const instituicao = role === 'lar'
  const equipa = role === 'equipa'

  // linha 1, à direita: o estado do pedido da família ou, com acesso completo, a disponibilidade — o mesmo estado
  // (e a mesma cor do ponto) que o cartão: lugar livre mas já prometido à lista de espera (laranja, "lista à frente"),
  // "Vaga em breve" ou "Lista de espera". Na versão grátis, sem pedido, não há nada a dizer aqui.
  let ponto = ''
  let estado: ReactNode = null
  if (ativa) {
    ponto = ativa.estado === 'admitida' ? 'bg-leaf-500' : 'bg-terra-600'
    estado = ESTADO_CANDIDATURA_LABEL[ativa.estado]
  } else if (completo) {
    const { livres, unidade, disp } = dados
    const listaAFrente = livres > 0 && !dados.est.imediata
    ponto = PONTO[listaAFrente ? 'breve' : disp]
    estado = listaAFrente ? (
      <>
        {/* no telemóvel a linha é curta (o preço vem ao lado): só o essencial */}
        <span className="sm:hidden">Lista à frente</span>
        <span className="max-sm:hidden">{livres === 1 ? '1 lugar livre' : `${livres} lugares livres`} · lista à frente</span>
      </>
    ) : livres > 0 ? (
      `${livres} ${livres === 1 ? `${unidade.um} livre` : `${unidade.varios} livres`}`
    ) : (
      disponibilidadeTexto(lar, disp, true, true)
    )
  }

  // troca de ações (pedir → pedido enviado) anima, mas não à entrada
  const chave = `${completo ? 'completo' : 'gratis'}-${ativa ? `ativa-${ativa.id}` : minhaFicha ? 'gestor' : 'livre'}`
  const [chave0] = useState(chave)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const aplicar = () => root.style.setProperty(VAR_ALTURA, visivel ? `${el.offsetHeight}px` : '0px')
    aplicar()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(aplicar) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.removeProperty(VAR_ALTURA)
    }
  }, [visivel])

  const botao = 'min-h-[3.25rem] flex-1 px-4'

  return createPortal(
    <div
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-[999] border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150 lg:hidden',
        'transition-[transform,translate,scale,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
      aria-hidden={!visivel}
      inert={!visivel}
    >
      {/* telemóvel: duas linhas (preço / ações largas); tablet: uma linha com as ações à direita */}
      <div className="container-page pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex sm:items-center sm:gap-8">
        <div className="flex items-center justify-between gap-3 leading-tight sm:min-w-0 sm:flex-1 sm:flex-col sm:items-start sm:gap-1">
          <p className="min-w-0 truncate text-ink">
            <PrecoLinha lar={lar} completo={completo} />
          </p>
          {estado != null && (
            <p className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ponto)} />
              {estado}
            </p>
          )}
        </div>

        <div key={chave} className={cn('mt-2.5 flex gap-2 sm:mt-0 sm:w-[28rem] sm:shrink-0', chave !== chave0 && 'ficha-troca')}>
          {ativa ? (
            <ButtonLink to="/familia/pedidos" className={botao}>
              {acaoDoPedido(ativa)}
            </ButtonLink>
          ) : minhaFicha ? (
            <ButtonLink to="/gestao/ficha" className={botao}>
              Editar ficha e vagas
            </ButtonLink>
          ) : equipa ? (
            // equipa de terreno: a ação é registar a visita (modo visita), não pedir vaga
            <ButtonLink to={`/visitas/${encodeURIComponent(lar.id)}`} className={botao}>
              Registar visita
            </ButtonLink>
          ) : !completo && !instituicao ? (
            // versão grátis: uma só ação, para a página do Acesso Família (volta a esta ficha depois de ativar)
            <ButtonLink to={linkAcesso(caminhoFicha(lar))} className={botao}>
              Ver vagas e preços
            </ButtonLink>
          ) : !completo ? (
            <>
              <Button variant="subtle" onClick={onVisita} className={botao}>
                Marcar visita
              </Button>
              <Button onClick={onPedir} className={botao}>
                {pedirGenerico(dados)}
              </Button>
            </>
          ) : (
            <>
              {!profissional && (
                <Button variant="subtle" onClick={onVisita} className={botao}>
                  Marcar visita
                </Button>
              )}
              <Button onClick={onPedir} className={botao}>
                {ctaPedido(dados, !profissional)}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
