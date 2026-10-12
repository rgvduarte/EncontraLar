/**
 * Os três "ecrãs" do telemóvel na cena "Como funciona" — UI real do EncontraLar (mapa, cartão, ficha, previsão),
 * composta como uma captura. São ilustrativos: o contentor é `inert` (sem foco nem leitor de ecrã), e o texto
 * de cada passo descreve o que mostram.
 *
 * Cada ecrã recebe `ativo`: ao ficar ativo, as peças entram por ordem (só opacity/transform).
 */
import { memo, type CSSProperties, type ReactNode } from 'react'
import { BellRing, Check, CircleUserRound, Compass, Heart, House, Map as MapIcon, Search } from 'lucide-react'
import type { Lar } from '@/types'
import { PT_VIEWBOX, projectPT } from '@/data/portugal-shape'
import { PortugalMap } from '@/components/brand/PortugalMap'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { LarCard } from '@/components/lar/LarCard'
import { LarCover } from '@/components/lar/LarCover'
import { VerifiedBadge } from '@/components/lar/badges'
import { LogoMark } from '@/components/layout/Logo'
import { resumoPrevisao, type EstimativaEspera } from '@/lib/forecast'
import { NATUREZA_LABEL, QUARTO_CURTO, TIPO_LABEL } from '@/lib/labels'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface Historia {
  lar: Lar
  est: EstimativaEspera
  lares: Lar[]
  agora: number
}

const T = 'transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none'

/** Peça que entra (sobe e aparece) quando o ecrã fica ativo, com atraso próprio. */
function Peca({ ativo, atraso = 0, de = 18, className, children }: { ativo: boolean; atraso?: number; de?: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(T, className)}
      style={{
        transitionDelay: ativo ? `${atraso}ms` : '0ms',
        opacity: ativo ? 1 : 0,
        transform: ativo ? 'none' : `translate3d(0, ${de}px, 0)`,
      }}
    >
      {children}
    </div>
  )
}

// ————————————————————————————————————————— moldura

/** Telemóvel minimalista: aro preto, ilha no topo, ecrã branco. A altura define o tamanho (proporção 9:19,5). */
export function Telefone({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative aspect-[9/19.5] shrink-0 rounded-[2.9rem] bg-ink p-[9px] shadow-lift ring-1 ring-black/10', className)}>
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-white" inert aria-hidden>
        {children}
        <span aria-hidden className="absolute top-2.5 left-1/2 z-30 h-[1.45rem] w-[5.5rem] -translate-x-1/2 rounded-full bg-ink" />
      </div>
    </div>
  )
}

// ————————————————————————————————————————— 1 · mapa

/** Onde fica o ponto da instituição no mapa do ecrã 1 (em % da caixa do mapa). */
const ALVO = { x: 42, y: 40 }

export const EcraMapa = memo(function EcraMapa({ h, ativo }: { h: Historia; ativo: boolean }) {
  const { lar, lares } = h
  const p = projectPT(lar.lat, lar.lng)
  const ox = ((p.x - PT_VIEWBOX.x) / PT_VIEWBOX.w) * 100
  const oy = ((p.y - PT_VIEWBOX.y) / PT_VIEWBOX.h) * 100
  // leva o ponto da instituição para cima da folha (um pouco à esquerda do centro: a costa fica a oeste e
  // assim vê-se mais terra) e aproxima (zoom) quando o passo fica ativo
  const zoom: CSSProperties = {
    transformOrigin: `${ox}% ${oy}%`,
    transform: `translate(${ALVO.x - ox}%, ${ALVO.y - oy}%) scale(${ativo ? 2.6 : 1.8})`,
    transitionDuration: '1600ms',
  }
  return (
    <div className="absolute inset-0 bg-sand">
      <div className="absolute inset-x-0 top-0 aspect-[435/560] overflow-hidden">
        <div className={cn(T, 'absolute inset-x-0 top-0')} style={zoom}>
          <PortugalMap lares={lares} labels={false} pulse={false} title="" />
        </div>
        {/* a instituição escolhida */}
        <span style={{ left: `${ALVO.x}%`, top: `${ALVO.y}%` }} className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-sun-500/30 motion-reduce:hidden" />
          <span className="relative size-3.5 rounded-full bg-sun-500 ring-[3px] ring-white" />
        </span>
      </div>

      <Peca ativo={ativo} atraso={150} de={-12} className="absolute inset-x-3 top-11 z-10">
        <div className="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm shadow-card ring-1 ring-black/5">
          <Search aria-hidden className="size-4 text-ink-mute" />
          <span className="flex-1 truncate font-medium text-ink">{lar.concelho}</span>
          <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink-soft">15 km</span>
        </div>
      </Peca>

      {/* folha inferior com o cartão real da instituição */}
      <Peca ativo={ativo} atraso={420} de={120} className="absolute inset-x-0 bottom-0 z-10">
        <div className="rounded-t-[1.75rem] bg-white px-3 pt-2 pb-4 shadow-[0_-10px_30px_rgb(0_0_0/0.08)]">
          <span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line-strong" />
          {/* versão compacta do cartão real: capa mais baixa e sem a linha de cuidados (cabe num ecrã pequeno) */}
          <LarCard lar={lar} className="[&>div:first-child]:aspect-[16/7] [&>div:last-child>p:nth-of-type(2)]:hidden [&_h3]:text-base" />
        </div>
      </Peca>
    </div>
  )
})

// ————————————————————————————————————————— 2 · comparar

export const EcraFicha = memo(function EcraFicha({ h, ativo }: { h: Historia; ativo: boolean }) {
  const { lar, est, agora } = h
  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <Peca ativo={ativo} de={-10} className="h-[6.5rem]">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
      </Peca>
      <div className="px-5 pt-4">
        <Peca ativo={ativo} atraso={90}>
          <p className="text-lg leading-snug font-semibold tracking-[-0.015em] text-ink">{lar.nome}</p>
          <p className="mt-0.5 truncate text-xs text-ink-mute">
            {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
          </p>
          <VerifiedBadge lar={lar} className="mt-1.5" />
        </Peca>

        <Peca ativo={ativo} atraso={200} className="mt-4">
          <p className="text-xs font-semibold text-ink">Mensalidade</p>
          <dl className="mt-1 divide-y divide-line text-sm">
            {lar.quartos.slice(0, 2).map((q) => (
              <div key={q.tipo} className="flex items-baseline justify-between gap-3 py-1.5">
                <dt className="text-ink-soft">{QUARTO_CURTO[q.tipo]}</dt>
                <dd className="font-semibold text-ink tabular">
                  {q.precoMin === q.precoMax ? euro(q.precoMin) : `${num(q.precoMin)}–${euro(q.precoMax)}`}
                </dd>
              </div>
            ))}
          </dl>
        </Peca>

        <Peca ativo={ativo} atraso={320} className="mt-4">
          <p className="text-xs font-semibold text-ink">Previsão de vaga</p>
          {/* no ecrã do telemóvel: só % e barra (sem o rótulo por baixo) */}
          <ForecastStrip
            curva={est.curva}
            meses={3}
            inicio={new Date(agora)}
            className="mt-3 grid-cols-3 gap-x-3 sm:grid-cols-3 [&_.text-3xl]:text-[1.375rem] [&_li>span:last-child]:hidden"
          />
        </Peca>
      </div>

      {/* barra de ação da ficha, como no telemóvel: o preço e "Pedir vaga" (leva ao passo seguinte) */}
      <Peca ativo={ativo} atraso={480} de={56} className="absolute inset-x-0 bottom-0">
        <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-white/90 px-4 pt-2.5 pb-4 backdrop-blur-xl">
          <p className="leading-tight text-ink">
            <span className="text-xs text-ink-mute">desde </span>
            <span className="font-semibold tabular">{euro(lar.mensalidadeMin)}</span>
            <span className="text-xs text-ink-mute">/mês</span>
          </p>
          <span className="rounded-full bg-ink px-4 py-2.5 text-sm font-medium whitespace-nowrap text-white">Pedir vaga</span>
        </div>
      </Peca>
    </div>
  )
})

// ————————————————————————————————————————— 3 · pedir vaga e alertas

const ABAS = [
  [House, 'Início'],
  [MapIcon, 'Mapa'],
  [Compass, 'Escolher'],
  [Heart, 'Guardados'],
  [CircleUserRound, 'Painel'],
] as const

export const EcraAlerta = memo(function EcraAlerta({ h, ativo }: { h: Historia; ativo: boolean }) {
  const { lar, est } = h
  const quarto = lar.quartos[0] ? QUARTO_CURTO[lar.quartos[0].tipo].toLowerCase() : null
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-sand px-5 pt-[9.75rem] text-center">
      <Peca ativo={ativo} atraso={60} className="flex flex-col items-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-leaf-500 text-white">
          <Check aria-hidden className="size-7" strokeWidth={2.75} />
        </span>
        <p className="mt-4 text-lg font-semibold text-ink">Pedido enviado</p>
        <p className="mt-0.5 text-sm leading-snug text-ink-mute">{lar.nome}</p>
      </Peca>

      <Peca ativo={ativo} atraso={180} className="mt-6 w-full">
        <div className="divide-y divide-line rounded-2xl bg-white px-4 text-left text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-2 font-medium text-ink">
              <BellRing aria-hidden className="size-4 text-terra-600" />
              Alertas de vaga
            </span>
            {/* interruptor ligado (ilustrativo) */}
            <span className="relative h-6 w-10 rounded-full bg-leaf-500">
              <span className="absolute top-0.5 right-0.5 size-5 rounded-full bg-white shadow-soft" />
            </span>
          </div>
          <p className="py-3 text-ink-mute">{resumoPrevisao(lar, est)}</p>
        </div>
      </Peca>

      {/* barra de abas da app (como no telemóvel), com o Painel — onde ficam os pedidos — ativo */}
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-5 border-t border-black/[0.08] bg-white/90 pt-2 pb-3.5">
        {ABAS.map(([Icon, rotulo], i) => (
          <span key={rotulo} className={cn('flex flex-col items-center gap-1 text-[0.625rem] leading-none font-medium', i === 4 ? 'text-ink' : 'text-ink-mute')}>
            <Icon aria-hidden className="size-[1.15rem]" strokeWidth={i === 4 ? 2.2 : 1.8} />
            {rotulo}
          </span>
        ))}
      </div>

      {/* a notificação desce do topo, como no telemóvel */}
      <div
        className={cn(T, 'absolute inset-x-2.5 top-11 z-20')}
        style={{
          transitionDelay: ativo ? '750ms' : '0ms',
          transitionDuration: '1000ms',
          opacity: ativo ? 1 : 0,
          transform: ativo ? 'none' : 'translate3d(0, -130%, 0) scale(0.96)',
        }}
      >
        <div className="flex items-start gap-3 rounded-[1.35rem] bg-white/85 p-3 text-left shadow-lift ring-1 ring-black/5 backdrop-blur-xl">
          <LogoMark className="size-9 shrink-0" />
          <div className="min-w-0 flex-1 leading-snug">
            <p className="flex items-baseline justify-between gap-2 text-xs text-ink-mute">
              <span className="font-medium text-ink-soft">EncontraLar</span>
              agora
            </p>
            <p className="text-sm font-semibold text-ink">Abriu uma vaga</p>
            <p className="line-clamp-2 text-xs text-ink-soft">
              {lar.nome}
              {quarto && `: quarto ${quarto} livre`}.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

export const ECRAS = [EcraMapa, EcraFicha, EcraAlerta] as const
