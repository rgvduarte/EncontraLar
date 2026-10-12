import type { ReactNode } from 'react'
import { ArrowDownUp, MapPin, X } from 'lucide-react'
import { CUIDADO_LABEL, GRAU_LABEL, NATUREZA_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import { cn } from '@/lib/cn'
import { DispGlyph, PillSelect, ToggleChip } from './Chips'
import type { SearchModel } from './useSearch'
import { centroDe, FILTROS_VAZIOS, ORDEM_LABEL, ORDENS, rotuloLocal, TIPO_CURTO, type SearchState, type VagaFiltro } from './searchState'

interface Pilula {
  id: string
  texto: string
  icon?: ReactNode
  patch: Partial<SearchState>
}

export function pilulasAtivas(s: SearchState): Pilula[] {
  const out: Pilula[] = []
  if (s.local.tipo !== 'pais') {
    const raio = centroDe(s.local) ? ` · ${s.raio} km` : ''
    out.push({ id: 'local', texto: `${rotuloLocal(s.local)}${raio}`, icon: <MapPin aria-hidden className="size-4" />, patch: { local: { tipo: 'pais' } } })
  }
  if (s.vaga === 'agora') out.push({ id: 'vaga', texto: 'Com vaga agora', icon: <DispGlyph disp="disponivel" />, patch: { vaga: null } })
  if (s.vaga === 'breve') out.push({ id: 'vaga', texto: 'Vaga agora ou em breve', icon: <DispGlyph disp="breve" />, patch: { vaga: null } })
  for (const t of s.tipos) out.push({ id: `t-${t}`, texto: TIPO_CURTO[t], patch: { tipos: s.tipos.filter((x) => x !== t) } })
  if (s.max != null) out.push({ id: 'max', texto: `Até ${euro(s.max)}/mês`, patch: { max: null } })
  if (s.grau) out.push({ id: 'grau', texto: GRAU_LABEL[s.grau], patch: { grau: null } })
  for (const c of s.cuidados) out.push({ id: `c-${c}`, texto: CUIDADO_LABEL[c], patch: { cuidados: s.cuidados.filter((x) => x !== c) } })
  if (s.ss) out.push({ id: 'ss', texto: 'Acordo com a Segurança Social', patch: { ss: false } })
  for (const n of s.naturezas) out.push({ id: `n-${n}`, texto: NATUREZA_LABEL[n], patch: { naturezas: s.naturezas.filter((x) => x !== n) } })
  if (s.q) out.push({ id: 'q', texto: `Nome com «${s.q}»`, patch: { q: '' } })
  return out
}

/** Seletor de ordenação ("Mais perto" só quando há um centro). */
export function SortSelect({ model, className }: { model: SearchModel; className?: string }) {
  const { state, update } = model
  const centro = centroDe(state.local)
  return (
    <PillSelect
      label="Ordenar"
      icon={<ArrowDownUp aria-hidden />}
      value={state.ordem}
      onChange={(e) => update({ ordem: e.target.value as SearchState['ordem'] })}
      wrapperClassName={className}
    >
      {ORDENS.filter((o) => o !== 'distancia' || centro).map((o) => (
        <option key={o} value={o}>
          {ORDEM_LABEL[o]}
        </option>
      ))}
    </PillSelect>
  )
}

/** "Com vaga agora" / "Vaga em breve" — atalhos visíveis no telemóvel (o resto fica no modal). */
export function QuickVaga({ model, className }: { model: SearchModel; className?: string }) {
  const { state, update } = model
  const setVaga = (v: VagaFiltro) => update({ vaga: state.vaga === v ? null : v })
  return (
    <div role="group" aria-label="Disponibilidade" className={cn('grid grid-cols-2 gap-2', className)}>
      <ToggleChip
        pressed={state.vaga === 'agora'}
        onClick={() => setVaga('agora')}
        icon={<DispGlyph disp="disponivel" onDark={state.vaga === 'agora'} />}
        className="justify-center px-3"
      >
        Com vaga agora
      </ToggleChip>
      <ToggleChip
        pressed={state.vaga === 'breve'}
        onClick={() => setVaga('breve')}
        icon={<DispGlyph disp="breve" onDark={state.vaga === 'breve'} />}
        className="justify-center px-3"
      >
        Vaga em breve
      </ToggleChip>
    </div>
  )
}

/** Pílulas removíveis dos filtros ativos (inclui o local). */
export function ActivePills({ model, className, semLocal }: { model: SearchModel; className?: string; semLocal?: boolean }) {
  const { state, update } = model
  const pilulas = pilulasAtivas(state).filter((p) => !semLocal || p.id !== 'local')
  if (!pilulas.length) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="sr-only">Filtros ativos:</span>
      <ul className="contents">
        {pilulas.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => update(p.patch)}
              aria-label={`Retirar filtro: ${p.texto}`}
              className="group inline-flex min-h-10 items-center gap-2 rounded-full border border-pine-200 bg-white py-1 pr-1.5 pl-3 text-sm font-semibold text-pine-900 transition-colors hover:border-terra-300 hover:bg-terra-50 hover:text-terra-800"
            >
              {p.icon}
              <span className="max-w-[16rem] truncate">{p.texto}</span>
              <span className="flex size-7 items-center justify-center rounded-full bg-pine-50 group-hover:bg-white">
                <X aria-hidden className="size-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pilulas.length > 1 && (
        <button
          type="button"
          onClick={() => update({ ...FILTROS_VAZIOS, local: { tipo: 'pais' } })}
          className="inline-flex min-h-10 items-center rounded-full px-2 text-sm font-bold text-terra-700 underline decoration-terra-300 decoration-2 underline-offset-4 hover:text-terra-900"
        >
          Limpar tudo
        </button>
      )}
    </div>
  )
}
