import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { precoResumo, type DadosLar } from './helpers'

const PONTO = { disponivel: 'bg-leaf-500', breve: 'bg-sun-500', espera: 'bg-dusk-500' } as const

/** Altura da barra visível, para outros elementos fixos no fundo (ex.: avisos) se poderem afastar. */
const VAR_ALTURA = '--actionbar-h'

/**
 * Barra de ação fixa no fundo (telemóvel/tablet — nesta rota não há barra de abas), ao alcance do polegar:
 * linha 1 = preço e disponibilidade; linha 2 = ação secundária + principal, largas (≥ 52px).
 * Some quando as ações do cartão estão à vista e no fim da ficha. Respeita a safe area do iPhone.
 * Vai para o <body> num portal: a transição de página aplica transform ao contentor, o que prenderia o
 * `position: fixed` ao fundo do documento em vez do ecrã.
 */
export function MobileActionBar({
  lar,
  dados,
  ativa,
  minhaFicha,
  visivel,
  onPedir,
  onVisita,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  minhaFicha: boolean
  visivel: boolean
  onPedir: () => void
  onVisita: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const preco = precoResumo(lar)
  const { livres, unidade, disp } = dados
  const estado = ativa
    ? ESTADO_CANDIDATURA_LABEL[ativa.estado]
    : livres > 0
      ? `${livres} ${livres === 1 ? `${unidade.um} livre` : `${unidade.varios} livres`}`
      : 'Lista de espera'

  // troca de ações (pedir → pedido enviado) anima, mas não à entrada
  const chave = ativa ? `ativa-${ativa.id}` : minhaFicha ? 'gestor' : 'livre'
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
        'fixed inset-x-0 bottom-0 z-[950] border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150 lg:hidden',
        'transition-[transform,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
      aria-hidden={!visivel}
      inert={!visivel}
    >
      <div className="container-page pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 leading-tight">
          <p className="min-w-0 truncate text-ink">
            {preco ? (
              <>
                {preco.desde && <span className="text-sm text-ink-mute">desde </span>}
                <span className="text-lg font-semibold tabular">{preco.valor}</span>
                <span className="text-sm text-ink-mute">/mês</span>
              </>
            ) : (
              <span className="font-semibold">Preço sob consulta</span>
            )}
          </p>
          <p className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ativa ? 'bg-terra-600' : PONTO[disp])} />
            {estado}
          </p>
        </div>

        <div key={chave} className={cn('mt-2.5 flex gap-2', chave !== chave0 && 'ficha-troca')}>
          {ativa ? (
            <ButtonLink to="/familia/pedidos" className={botao}>
              Acompanhar o pedido
            </ButtonLink>
          ) : minhaFicha ? (
            <ButtonLink to="/gestao/ficha" className={botao}>
              Editar ficha e vagas
            </ButtonLink>
          ) : (
            <>
              <Button variant="subtle" onClick={onVisita} className={botao}>
                Marcar visita
              </Button>
              <Button onClick={onPedir} className={botao}>
                {livres > 0 ? (dados.centroDia ? 'Pedir lugar' : 'Pedir vaga') : 'Entrar na lista'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
