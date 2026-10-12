/**
 * Pré-visualizações de interface REAL para "Como funciona" — construídas com os componentes
 * da aplicação e dados do store, não com ilustrações genéricas.
 */
import { Link } from 'react-router'
import { BellRing, Check, CircleDot, MapPin, Search, X } from 'lucide-react'
import type { Lar } from '@/types'
import type { LugarPesquisa } from '@/data/localidades'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge } from '@/components/lar/badges'
import { LogoMark } from '@/components/layout/Logo'
import { ESTADO_CANDIDATURA_LABEL, GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { scoreLabel, type MatchResult, type TipoRazao } from '@/lib/matching'
import { euro, km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { perfilExemplo, type ResultadoPerto } from './homeData'

/** Tabuleiro onde pousa cada pré-visualização. */
export function Tray({ children, caption, className }: { children: React.ReactNode; caption: React.ReactNode; className?: string }) {
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <div className="rounded-[1.75rem] border border-line-strong/60 bg-sand-deep/60 p-3 sm:p-5">{children}</div>
      <figcaption className="px-1 text-sm text-ink-mute">{caption}</figcaption>
    </figure>
  )
}

// ————————————————————————————————————————— 01 · pesquisa

export function PreviewPesquisa({ lugar, resultados }: { lugar: LugarPesquisa; resultados: ResultadoPerto[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-cream px-4 py-3">
        <span className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border-2 border-pine-600 bg-white px-3 font-bold">
          <MapPin aria-hidden className="size-5 text-pine-700" />
          {lugar.label}
        </span>
        <span className="rounded-full bg-pine-50 px-3 py-1.5 text-sm font-bold text-pine-800">até {lugar.raio} km</span>
        <span className="flex size-11 items-center justify-center rounded-xl bg-pine-700 text-white">
          <Search aria-hidden className="size-5" />
        </span>
      </div>
      <ul className="divide-y divide-line">
        {resultados.map(({ lar, distancia }) => (
          <li key={lar.id}>
            <Link to={`/lar/${lar.id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-cream">
              <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-sand">
                <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold group-hover:underline">{lar.nome}</span>
                <span className="block text-sm text-ink-soft">
                  a {km(distancia)} · desde <strong className="text-ink tabular">{euro(lar.mensalidadeMin)}</strong>
                </span>
                <span className="mt-1.5 block sm:hidden">
                  <AvailabilityBadge lar={lar} />
                </span>
              </span>
              <span className="hidden shrink-0 sm:block">
                <AvailabilityBadge lar={lar} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ————————————————————————————————————————— 02 · compatibilidade

const RAZAO: Record<TipoRazao, { Icon: typeof Check; cls: string; sr: string }> = {
  ok: { Icon: Check, cls: 'bg-leaf-100 text-leaf-700', sr: 'Cumpre' },
  parcial: { Icon: CircleDot, cls: 'bg-sun-100 text-sun-800', sr: 'Em parte' },
  falta: { Icon: X, cls: 'bg-alert-50 text-alert-700', sr: 'Não cumpre' },
}

export function PreviewCompatibilidade({ lar, match }: { lar: Lar; match: MatchResult }) {
  const razoes = [...match.razoes.filter((r) => r.tipo === 'ok').slice(0, 4), ...match.razoes.filter((r) => r.tipo !== 'ok').slice(0, 2)]
  const s = match.score
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div
          className="relative flex size-20 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--color-pine-600) ${s * 3.6}deg, var(--color-sand-deep) 0deg)` }}
          role="img"
          aria-label={`${s}% compatível`}
        >
          <span className="flex size-15 items-center justify-center rounded-full bg-white font-display text-xl font-semibold text-pine-800 tabular">
            {s}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-pine-700">{scoreLabel(s)}</p>
          <Link to={`/lar/${lar.id}`} className="block font-display text-xl leading-snug font-semibold hover:underline">
            {lar.nome}
          </Link>
          <p className="text-sm text-ink-soft">
            {lar.localidade} · quarto {QUARTO_CURTO.individual.toLowerCase()} desde {euro(match.precoRef)}
          </p>
        </div>
      </div>
      <ul className="grid gap-x-4 gap-y-2.5 px-4 py-4 sm:grid-cols-2 sm:px-5">
        {razoes.map((r) => {
          const R = RAZAO[r.tipo]
          return (
            <li key={r.texto} className="flex items-start gap-2.5 text-sm leading-snug">
              <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', R.cls)}>
                <R.Icon aria-hidden className="size-3.5" strokeWidth={3} />
              </span>
              <span>
                <span className="sr-only">{R.sr}: </span>
                {r.texto}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export const descricaoPerfilExemplo = (lugar: LugarPesquisa) =>
  `Perfil fictício: mãe de 84 anos, ${GRAU_LABEL.moderada.toLowerCase()}, com demência inicial, a precisar de fisioterapia, orçamento até ${euro(perfilExemplo(lugar).orcamentoMax)} e família em ${lugar.label}.`

// ————————————————————————————————————————— 03 · alertas

const PERCURSO = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta'] as const

export function PreviewAlerta({ lar }: { lar: Lar }) {
  const quarto = lar.quartos[0]?.tipo ?? 'individual'
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-white/95 p-4 shadow-lift backdrop-blur sm:p-5">
        <div className="flex items-center gap-2 text-sm text-ink-mute">
          <LogoMark className="size-6" />
          <span className="font-bold text-ink-soft">EncontraLar</span>
          <span aria-hidden>·</span>
          <span>agora</span>
        </div>
        <p className="mt-2 text-lg font-bold text-ink">Abriu uma vaga onde está inscrito(a)</p>
        <p className="mt-1 text-ink-soft">
          {lar.nome} tem uma nova vaga (quarto {QUARTO_CURTO[quarto].toLowerCase()}). A instituição contacta as famílias pela ordem da
          lista — está na posição 2.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Percurso de um pedido de vaga">
        {PERCURSO.map((e, i) => {
          const atual = i === PERCURSO.length - 1
          return (
            <li
              key={e}
              aria-current={atual ? 'step' : undefined}
              className={cn(
                'flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-sm leading-tight',
                atual ? 'border-terra-300 bg-terra-50 font-bold text-terra-800' : 'border-line bg-white text-ink-soft',
              )}
            >
              {atual ? (
                <BellRing aria-hidden className="size-5 text-terra-600" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full bg-leaf-100 text-leaf-700">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
              )}
              {ESTADO_CANDIDATURA_LABEL[e]}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
