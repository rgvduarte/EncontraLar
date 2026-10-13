import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { ChevronRight, X } from 'lucide-react'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge } from '@/components/lar/badges'
import { buttonClasses } from '@/components/ui/Button'
import { faixaPreco } from '@/lib/acesso'
import { resumoPrevisao } from '@/lib/forecast'
import { TIPO_LABEL } from '@/lib/labels'
import { euro, km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { comVagaAgora, type Entrada } from './filtering'

function Preco({ e }: { e: Entrada }) {
  const { lar } = e
  const social = lar.natureza !== 'privado'
  return (
    <p className="leading-tight text-ink">
      <span className="text-lg font-semibold tabular">{social ? `${euro(lar.mensalidadeMin)}–${euro(lar.mensalidadeMax)}` : euro(lar.mensalidadeMin)}</span>
      <span className="text-sm text-ink-mute"> /mês</span>
      {social && <span className="block text-sm text-ink-mute">conforme rendimentos</span>}
    </p>
  )
}

/** Versão grátis: só a faixa de preço (o preço de cada quarto é do Acesso Família). */
function Faixa({ e }: { e: Entrada }) {
  return <p className="text-base leading-tight font-semibold text-ink">{faixaPreco(e.lar)}</p>
}

function Linha({ e }: { e: Entrada }) {
  const { lar } = e
  return (
    <p className="truncate text-sm text-ink-mute">
      {TIPO_LABEL[lar.tipo]} · {lar.localidade}
      {e.distanciaKm != null && ` · ${km(e.distanciaKm)}`}
    </p>
  )
}

/**
 * Popup do marcador (desktop): nome, estado, preço, "Ver ficha ›".
 * Versão grátis (`completo` false): genérico — tipo, localidade, nome, faixa de preço e "Ver ficha ›".
 */
export function MapPopupContent({ e, completo = true }: { e: Entrada; completo?: boolean }) {
  const { lar } = e
  return (
    <div className="flex flex-col gap-3 p-5 font-sans text-ink">
      <div className="pr-8">
        <Linha e={e} />
        <p className="mt-1 text-lg leading-snug font-semibold tracking-[-0.015em]">{lar.nome}</p>
      </div>
      {completo && (
        <div className="flex flex-col items-start gap-1.5">
          <AvailabilityBadge lar={lar} estado={e.disp} est={e.est} />
          {/* sem vaga para quem pede hoje (inclui lugar livre com lista à frente): mostrar a espera estimada */}
          {!comVagaAgora(e) && lar.tipo !== 'centro_dia' && <p className="text-sm text-ink-mute">{resumoPrevisao(lar, e.est)}</p>}
        </div>
      )}
      {/* versão grátis: a faixa (texto mais comprido do que um preço) fica por cima da ligação, sem partir a meio */}
      <div className={completo ? 'flex items-end justify-between gap-3' : 'flex flex-col items-start'}>
        {completo ? <Preco e={e} /> : <Faixa e={e} />}
        <Link to={`/lar/${lar.id}`} className="inline-flex min-h-11 shrink-0 items-center font-medium text-terra-600! hover:underline">
          Ver ficha
          <ChevronRight aria-hidden className="size-4.5" />
        </Link>
      </div>
    </div>
  )
}

/**
 * Arrastar para baixo para fechar (como uma folha do iOS). Só "agarra" o ponteiro depois de 6px,
 * para que um toque simples continue a abrir a ficha ou a fechar.
 */
function useArrastarParaFechar(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const gesto = useRef<{ id: number; y0: number; t0: number; dy: number; ativo: boolean } | null>(null)
  const arrastou = useRef(false)

  const onPointerDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return
    gesto.current = { id: ev.pointerId, y0: ev.clientY, t0: performance.now(), dy: 0, ativo: false }
    arrastou.current = false
  }
  const onPointerMove = (ev: PointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    const el = ref.current
    if (!g || !el || ev.pointerId !== g.id) return
    const dy = ev.clientY - g.y0
    if (!g.ativo) {
      if (Math.abs(dy) < 6) return
      g.ativo = true
      arrastou.current = true
      el.setPointerCapture(ev.pointerId)
      el.style.transition = 'none'
    }
    g.dy = dy
    // para baixo segue o dedo; para cima, resistência (elástico)
    el.style.transform = `translateY(${dy > 0 ? dy : dy / 5}px)`
  }
  const onPointerEnd = () => {
    const g = gesto.current
    const el = ref.current
    gesto.current = null
    if (!g || !el || !g.ativo) return
    const v = g.dy / Math.max(1, performance.now() - g.t0)
    if (g.dy > 80 || (g.dy > 24 && v > 0.45)) {
      // a animação de saída parte de onde o dedo largou (search.css: el-sheet-out usa --dy)
      el.style.setProperty('--dy', `${g.dy}px`)
      onClose()
    } else {
      el.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      el.style.transform = ''
    }
  }
  const onClickCapture = (ev: MouseEvent<HTMLDivElement>) => {
    if (!arrastou.current) return
    arrastou.current = false
    ev.preventDefault()
    ev.stopPropagation()
  }
  return { ref, handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture } }
}

/**
 * Folha que sobe do fundo do mapa no telemóvel ao tocar num marcador.
 * Trocar de marcador só troca o conteúdo; deslizar para baixo, tocar no mapa ou em "Fechar" fecha-a.
 * Versão grátis (`completo` false): genérica — nome, tipo, localidade, faixa de preço e "Ver ficha".
 */
export function MapPeekCard({ e, saindo, onClose, completo = true }: { e: Entrada; saindo?: boolean; onClose: () => void; completo?: boolean }) {
  const { lar } = e
  const { ref, handlers } = useArrastarParaFechar(onClose)
  const primeiro = useRef(lar.id)
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Instituição selecionada: ${lar.nome}`}
      data-saindo={saindo || undefined}
      {...handlers}
      className="el-sheet pointer-events-auto relative rounded-[1.75rem] bg-white p-3 pt-5 shadow-lift ring-1 ring-black/5"
    >
      <span aria-hidden className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-sand-deep" />
      <div key={lar.id} className={cn('flex gap-4', lar.id !== primeiro.current && 'el-sheet-conteudo')}>
        <div className="relative w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-sand">
          <LarCover hue={lar.capa.hue} variante={lar.capa.variante} className="absolute inset-0 h-full w-full" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pr-11">
          <p className="text-lg leading-snug font-semibold tracking-[-0.015em] text-ink">{lar.nome}</p>
          <Linha e={e} />
          {completo && <AvailabilityBadge lar={lar} estado={e.disp} est={e.est} className="self-start" />}
          <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
            {completo ? <Preco e={e} /> : <Faixa e={e} />}
            <Link to={`/lar/${lar.id}`} className={buttonClasses('primary', 'sm', 'min-h-12 px-5 transition-[background-color,scale] active:scale-[0.97]')}>
              Ver ficha
            </Link>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-2 right-2 flex size-12 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand hover:text-ink"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  )
}
