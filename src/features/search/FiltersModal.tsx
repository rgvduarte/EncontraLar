import { useEffect, useId, useState, type ReactNode } from 'react'
import type { Cuidado, Natureza, TipoResposta } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Switch } from '@/components/ui/Field'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { BudgetSlider } from './BudgetControl'
import { TogglePill } from './Chips'
import { centroDe, FILTROS_VAZIOS, filtrosDe, NATUREZAS, opcoesRaio, TIPOS, type Filtros, type SearchState } from './searchState'

export type ModoFiltros = 'mais' | 'todos'
export type Rascunho = Filtros & { raio: number }

interface Props {
  open: boolean
  onClose: () => void
  /** 'mais' (desktop: o resto está na barra) ou 'todos' (telemóvel) */
  modo: ModoFiltros
  state: SearchState
  /** nº de resultados com um rascunho de filtros */
  contar: (r: Rascunho) => number
  /** mensalidades na zona (histograma do orçamento) */
  precos: number[]
  onApply: (r: Rascunho) => void
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold tracking-tight text-ink">{titulo}</legend>
      {ajuda && <p className="mt-0.5 text-sm text-ink-mute">{ajuda}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  )
}

/** Grupo de rádios nativos com aspeto de pílula (preta quando escolhida). */
function RadioPills<T extends string | number | null>({
  opcoes,
  value,
  onChange,
}: {
  opcoes: { v: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <label
          key={String(o.v)}
          className={cn(
            'inline-flex min-h-12 cursor-pointer items-center rounded-full px-4.5 text-sm font-medium transition-colors duration-200',
            'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
            value === o.v ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
          )}
        >
          <input type="radio" name={name} className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

/** "Mais filtros" (desktop) ou todos os filtros (telemóvel, folha inferior), com contagem ao vivo. */
export function FiltersModal({ open, onClose, modo, state, contar, precos, onApply }: Props) {
  const inicial = (): Rascunho => ({ ...filtrosDe(state), raio: state.raio })
  const [r, setR] = useState<Rascunho>(inicial)
  useEffect(() => {
    if (open) setR(inicial())
    // repõe o rascunho de cada vez que abre
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Rascunho>) => setR((x) => ({ ...x, ...patch }))
  const n = contar(r)
  const todos = modo === 'todos'
  const centro = centroDe(state.local)

  const limpar = () => set(todos ? { ...FILTROS_VAZIOS, q: r.q } : { grau: null, cuidados: [], ss: false, naturezas: [] })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={todos ? 'Filtros' : 'Mais filtros'}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" onClick={limpar} className="inline-flex min-h-12 items-center px-1 font-medium text-ink underline-offset-4 hover:underline">
            Limpar
          </button>
          <Button
            variant="primary"
            size="lg"
            disabled={n === 0}
            className="min-w-[13rem] max-sm:flex-1"
            onClick={() => {
              onApply(r)
              onClose()
            }}
          >
            <span aria-live="polite">{n === 0 ? 'Nenhum resultado' : n === 1 ? 'Ver 1 resultado' : `Ver ${n} resultados`}</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-10 pb-2">
        {todos && (
          <Secao titulo="Disponibilidade" ajuda="Vagas indicadas pelas instituições; «em breve» é uma previsão.">
            <RadioPills
              value={r.vaga}
              onChange={(vaga) => set({ vaga })}
              opcoes={[
                { v: null, label: 'Todas' },
                { v: 'agora', label: 'Com vaga agora' },
                { v: 'breve', label: 'Agora ou em breve' },
              ]}
            />
          </Secao>
        )}

        {todos && centro && (
          <Secao titulo="Distância">
            <RadioPills value={r.raio} onChange={(raio) => set({ raio })} opcoes={opcoesRaio(state.local).map((km) => ({ v: km, label: `${km} km` }))} />
          </Secao>
        )}

        {todos && (
          <Secao titulo="Tipo">
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t: TipoResposta) => (
                <TogglePill key={t} pressed={r.tipos.includes(t)} onClick={() => set({ tipos: toggle(r.tipos, t) })}>
                  {TIPO_LABEL[t]}
                </TogglePill>
              ))}
            </div>
          </Secao>
        )}

        {todos && (
          <Secao titulo="Orçamento">
            <BudgetSlider value={r.max} onChange={(max) => set({ max })} precos={precos} />
          </Secao>
        )}

        <Secao titulo="Grau de dependência" ajuda={r.grau ? GRAU_DESCRICAO[r.grau] : 'Mostra só quem aceita pessoas com este grau.'}>
          <RadioPills
            value={r.grau}
            onChange={(grau) => set({ grau })}
            opcoes={[{ v: null, label: 'Qualquer' }, ...GRAUS_ORDEM.map((g) => ({ v: g, label: GRAU_LABEL[g] }))]}
          />
        </Secao>

        <Secao titulo="Cuidados de saúde" ajuda="A instituição tem de assegurar todos os que escolher.">
          <div className="grid gap-x-6 sm:grid-cols-2">
            {CUIDADOS_ORDEM.map((c: Cuidado) => (
              <Checkbox key={c} checked={r.cuidados.includes(c)} onChange={() => set({ cuidados: toggle(r.cuidados, c) })} label={CUIDADO_LABEL[c]} />
            ))}
          </div>
        </Secao>

        <Secao titulo="Comparticipação">
          <Switch
            checked={r.ss}
            onChange={(ss) => set({ ss })}
            label="Só com acordo da Segurança Social"
            description="A mensalidade é calculada a partir dos rendimentos."
          />
        </Secao>

        <Secao titulo="Natureza">
          <div className="flex flex-wrap gap-2">
            {NATUREZAS.map((nat: Natureza) => (
              <TogglePill key={nat} pressed={r.naturezas.includes(nat)} onClick={() => set({ naturezas: toggle(r.naturezas, nat) })}>
                {NATUREZA_LABEL[nat]}
              </TogglePill>
            ))}
          </div>
        </Secao>
      </div>
    </Modal>
  )
}
