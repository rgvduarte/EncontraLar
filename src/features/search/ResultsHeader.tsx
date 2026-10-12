import type { ReactNode } from 'react'
import type { Disponibilidade, TipoResposta } from '@/types'
import { AzulejoBand } from '@/components/brand/patterns'
import { cn } from '@/lib/cn'
import { km, num } from '@/lib/format'
import { DispGlyph } from './Chips'
import type { Entrada } from './filtering'
import { lugarMaisProximo, type SearchState } from './searchState'

const NOME_TIPO: Record<TipoResposta, string> = {
  erpi: 'Lares',
  residencia: 'Residências seniores',
  centro_dia: 'Centros de dia',
}

function sujeito(tipos: TipoResposta[]) {
  return tipos.length === 1 ? NOME_TIPO[tipos[0]!] : 'Lares e residências'
}

/** Título (h1) que diz em palavras o que está a ver. */
export function tituloPesquisa(s: SearchState): { h1: ReactNode; texto: string; contexto: string } {
  const quem = sujeito(s.tipos)
  switch (s.local.tipo) {
    case 'lugar': {
      const label = s.local.lugar.label
      return {
        h1: (
          <>
            {quem} perto de <em>{label}</em>
          </>
        ),
        texto: `${quem} perto de ${label}`,
        contexto: `Num raio de ${s.raio} km à volta de ${label}.`,
      }
    }
    case 'coords': {
      const perto = lugarMaisProximo(s.local)
      return {
        h1: (
          <>
            {quem} <em>perto de si</em>
          </>
        ),
        texto: `${quem} perto de si`,
        contexto:
          perto && perto.km < 40
            ? `Num raio de ${s.raio} km da sua localização (a ${km(perto.km)} de ${perto.lugar.label}).`
            : `Num raio de ${s.raio} km da sua localização.`,
      }
    }
    case 'distrito':
      return {
        h1: (
          <>
            {quem} no distrito de <em>{s.local.distrito}</em>
          </>
        ),
        texto: `${quem} no distrito de ${s.local.distrito}`,
        contexto: 'Todas as localidades do distrito.',
      }
    case 'zona':
      return {
        h1: (
          <>
            {quem} <em>nesta zona</em> do mapa
          </>
        ),
        texto: `${quem} na zona escolhida no mapa`,
        contexto: 'A área que estava visível quando carregou em «Pesquisar nesta zona».',
      }
    default:
      return {
        h1: (
          <>
            {quem} em <em>todo o país</em>
          </>
        ),
        texto: `${quem} em todo o país`,
        contexto: 'Continente, Madeira e Açores.',
      }
  }
}

const SEG: { d: Disponibilidade; cor: string; rotulo: string }[] = [
  { d: 'disponivel', cor: 'bg-leaf-500', rotulo: 'com vaga agora' },
  { d: 'breve', cor: 'bg-sun-400', rotulo: 'vaga em breve' },
  { d: 'espera', cor: 'bg-dusk-500', rotulo: 'em lista de espera' },
]

/** Barómetro da disponibilidade nos resultados — também serve de legenda das cores do mapa. */
export function Barometro({ resultados, className }: { resultados: Entrada[]; className?: string }) {
  const total = resultados.length
  const conta: Record<Disponibilidade, number> = { disponivel: 0, breve: 0, espera: 0 }
  for (const e of resultados) conta[e.disp]++
  if (!total) return null
  return (
    <figure className={cn('flex flex-col gap-2.5', className)}>
      <div aria-hidden className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full">
        {SEG.map(({ d, cor }) =>
          conta[d] ? <span key={d} className={cn('h-full first:rounded-l-full last:rounded-r-full', cor)} style={{ flexGrow: conta[d] }} /> : null,
        )}
      </div>
      <figcaption>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          {SEG.map(({ d, rotulo }) => (
            <li key={d} className="inline-flex items-center gap-2">
              <DispGlyph disp={d} />
              <span>
                <strong className="text-ink tabular">{num(conta[d])}</strong> {rotulo}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}

interface HeaderProps {
  state: SearchState
  resultados: Entrada[]
  comVaga: number
  /** controlo à direita da contagem (ordenação) */
  acao?: ReactNode
  children?: ReactNode
}

export function ResultsHeader({ state, resultados, comVaga, acao, children }: HeaderProps) {
  const t = tituloPesquisa(state)
  const n = resultados.length
  return (
    <header className="relative overflow-hidden border-b border-line bg-sand/50 px-4 pt-5 pb-5 sm:px-6 lg:pt-6">
      <AzulejoBand
        className="absolute top-0 right-0 h-36 w-64 opacity-[0.14] [mask-image:linear-gradient(to_left,black_10%,transparent),linear-gradient(to_bottom,black,transparent)] [mask-composite:intersect]"
        size={44}
      />
      <p className="eyebrow relative">Mapa de vagas</p>
      <h1 className="relative mt-1.5 max-w-[32rem] text-3xl leading-tight font-semibold text-ink">{t.h1}</h1>
      <p className="relative mt-1.5 text-sm text-ink-soft">{t.contexto}</p>

      <div className="relative mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <p aria-live="polite" aria-atomic="true" className="flex flex-wrap items-baseline gap-x-2 text-base text-ink-soft">
          <span className="font-display text-3xl font-semibold text-ink tabular">{num(n)}</span>
          <span>{n === 1 ? 'instituição' : 'instituições'}</span>
          <span aria-hidden className="px-0.5 text-ink-mute">·</span>
          <span className="font-display text-3xl font-semibold text-leaf-700 tabular">{num(comVaga)}</span>
          <span>com vaga agora</span>
        </p>
        {acao}
      </div>
      <Barometro resultados={resultados} className="relative mt-3.5" />
      {children}
    </header>
  )
}
