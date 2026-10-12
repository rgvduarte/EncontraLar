import { X } from 'lucide-react'
import type { TipoResposta } from '@/types'
import { CUIDADO_LABEL, GRAU_LABEL, NATUREZA_LABEL } from '@/lib/labels'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DispDot, QuietSelect } from './Chips'
import type { SearchModel } from './useSearch'
import {
  centroDe,
  contarTodosFiltros,
  FILTROS_VAZIOS,
  ORDEM_LABEL,
  ORDENS,
  TIPO_CURTO,
  type SearchState,
} from './searchState'

const NOME_TIPO: Record<TipoResposta, string> = {
  erpi: 'Lares',
  residencia: 'Residências seniores',
  centro_dia: 'Centros de dia',
}

/** Título da página (h1 e separador do navegador) — diz em palavras o que se está a ver. */
export function tituloPesquisa(s: SearchState): string {
  const quem = s.tipos.length === 1 ? NOME_TIPO[s.tipos[0]!] : 'Lares e residências'
  switch (s.local.tipo) {
    case 'lugar':
      return `${quem} perto de ${s.local.lugar.label}`
    case 'coords':
      return `${quem} perto de si`
    case 'distrito':
      return `${quem} no distrito de ${s.local.distrito}`
    case 'zona':
      return `${quem} nesta zona do mapa`
    default:
      return `${quem} em todo o país`
  }
}

/** Onde aparece cada filtro: na barra (pílulas visíveis) ou só dentro de painéis. */
type Grupo = 'vaga' | 'tipo' | 'max' | 'mais'

interface Pilula {
  id: string
  grupo: Grupo
  texto: string
  patch: Partial<SearchState>
}

export function pilulasAtivas(s: SearchState): Pilula[] {
  const out: Pilula[] = []
  if (s.vaga) out.push({ id: 'vaga', grupo: 'vaga', texto: s.vaga === 'agora' ? 'Com vaga agora' : 'Vaga em breve', patch: { vaga: null } })
  for (const t of s.tipos) out.push({ id: `t-${t}`, grupo: 'tipo', texto: TIPO_CURTO[t], patch: { tipos: s.tipos.filter((x) => x !== t) } })
  if (s.max != null) out.push({ id: 'max', grupo: 'max', texto: `Até ${euro(s.max)}`, patch: { max: null } })
  if (s.grau) out.push({ id: 'grau', grupo: 'mais', texto: GRAU_LABEL[s.grau], patch: { grau: null } })
  for (const c of s.cuidados) out.push({ id: `c-${c}`, grupo: 'mais', texto: CUIDADO_LABEL[c], patch: { cuidados: s.cuidados.filter((x) => x !== c) } })
  if (s.ss) out.push({ id: 'ss', grupo: 'mais', texto: 'Acordo com a Segurança Social', patch: { ss: false } })
  for (const n of s.naturezas) out.push({ id: `n-${n}`, grupo: 'mais', texto: NATUREZA_LABEL[n], patch: { naturezas: s.naturezas.filter((x) => x !== n) } })
  if (s.q) out.push({ id: 'q', grupo: 'mais', texto: `Nome com «${s.q}»`, patch: { q: '' } })
  return out
}

interface Props {
  model: SearchModel
  /** desktop: Tipo e Orçamento já aparecem na barra */
  desktop: boolean
}

/** Cabeçalho calmo da lista: título, "N instituições · M com vaga agora", ordenação e filtros removíveis. */
export function ResultsSummary({ model, desktop }: Props) {
  const { state, resultados, comVaga, update } = model
  const n = resultados.length
  const centro = centroDe(state.local)
  const visiveis: Grupo[] = desktop ? ['mais'] : ['tipo', 'max', 'mais']
  const pilulas = pilulasAtivas(state).filter((p) => visiveis.includes(p.grupo))
  const total = contarTodosFiltros(state) + (state.q ? 1 : 0)

  return (
    <header className="px-5 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{tituloPesquisa(state)}</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        <p aria-live="polite" aria-atomic="true" className="text-base text-ink-mute">
          <span className="font-medium text-ink tabular">{num(n)}</span> {n === 1 ? 'instituição' : 'instituições'}
          {n > 0 && (
            <>
              <span aria-hidden> · </span>
              <span className="inline-flex items-baseline gap-1.5">
                <DispDot disp="disponivel" className="size-2.5 self-center" />
                <span>
                  <span className="font-medium text-ink tabular">{num(comVaga)}</span> com vaga agora
                </span>
              </span>
            </>
          )}
        </p>
        {n > 1 && (
          <QuietSelect
            label="Ordenar"
            value={state.ordem}
            onChange={(e) => update({ ordem: e.target.value as SearchState['ordem'] })}
            wrapperClassName="-mx-3 sm:mx-0 sm:-mr-3"
          >
            {ORDENS.filter((o) => o !== 'distancia' || centro).map((o) => (
              <option key={o} value={o}>
                {ORDEM_LABEL[o]}
              </option>
            ))}
          </QuietSelect>
        )}
      </div>

      {(pilulas.length > 0 || (total >= 2 && n > 0)) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2">
          {pilulas.length > 0 && <span className="sr-only">Filtros ativos:</span>}
          {pilulas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => update(p.patch)}
              aria-label={`Retirar filtro: ${p.texto}`}
              className="group inline-flex min-h-12 items-center rounded-full"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sand py-1.5 pr-2.5 pl-3.5 text-sm text-ink transition-colors duration-200 group-hover:bg-sand-deep">
                <span className="max-w-[16rem] truncate">{p.texto}</span>
                <X aria-hidden className="size-4 text-ink-mute" />
              </span>
            </button>
          ))}
          {total >= 2 && n > 0 && (
            <button
              type="button"
              onClick={() => update({ ...FILTROS_VAZIOS })}
              className={cn('inline-flex min-h-12 items-center px-2 text-sm font-medium text-terra-600 hover:underline', pilulas.length === 0 && '-ml-2')}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </header>
  )
}
