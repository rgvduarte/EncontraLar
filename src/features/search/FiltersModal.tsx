import { useEffect, useState, type ReactNode } from 'react'
import { CircleSlash } from 'lucide-react'
import type { Cuidado, GrauDependencia, Natureza, TipoResposta } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, ChoiceCard, Switch } from '@/components/ui/Field'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS, CUIDADOS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { BudgetSlider } from './BudgetControl'
import { chipClasses, DispGlyph } from './Chips'
import { centroDe, FILTROS_VAZIOS, filtrosDe, NATUREZAS, opcoesRaio, TIPOS, type Filtros, type SearchState, type VagaFiltro } from './searchState'

export type ModoFiltros = 'mais' | 'todos'
export type Rascunho = Filtros & { raio: number }

interface Props {
  open: boolean
  onClose: () => void
  modo: ModoFiltros
  state: SearchState
  /** nº de resultados com um rascunho de filtros */
  contar: (r: Rascunho) => number
  /** mensalidades na zona (histograma do orçamento) */
  precos: number[]
  onApply: (r: Rascunho) => void
}

const TIPO_RESUMO: Record<TipoResposta, string> = {
  erpi: 'Alojamento permanente, com cuidados diários e apoio de saúde.',
  residencia: 'Para quem ainda é autónomo; serviços de tipo hoteleiro.',
  centro_dia: 'Passa o dia no centro e regressa a casa ao fim da tarde.',
}

const NATUREZA_RESUMO: Record<Natureza, string> = {
  ipss: 'Sem fins lucrativos; mensalidade conforme os rendimentos.',
  misericordia: 'Santa Casa local; mensalidade conforme os rendimentos.',
  privado: 'Preço fixo por tipo de quarto e de cuidados.',
}

function Secao({ titulo, ajuda, children, className }: { titulo: string; ajuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('border-t border-line pt-6 first:border-t-0 first:pt-0', className)}>
      <legend className="float-left w-full">
        <span className="block font-display text-xl font-semibold text-ink">{titulo}</span>
        {ajuda && <span className="mt-1 block text-sm text-ink-soft">{ajuda}</span>}
      </legend>
      <div className="clear-left pt-4">{children}</div>
    </fieldset>
  )
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

/** "Mais filtros" (desktop) ou todos os filtros (telemóvel), com contagem ao vivo. */
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

  const limpar = () =>
    set(
      todos
        ? { ...FILTROS_VAZIOS, q: r.q }
        : { grau: null, cuidados: [], ss: false, naturezas: [] },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={todos ? 'Filtros' : 'Mais filtros'}
      description="O número de resultados atualiza enquanto escolhe."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" onClick={limpar}>
            Limpar
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={n === 0}
            onClick={() => {
              onApply(r)
              onClose()
            }}
            icon={n === 0 ? <CircleSlash aria-hidden className="size-5" /> : undefined}
          >
            <span aria-live="polite">{n === 0 ? 'Nenhum resultado' : n === 1 ? 'Ver 1 resultado' : `Ver ${n} resultados`}</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7 pb-2">
        {todos && (
          <Secao titulo="Disponibilidade" ajuda="As vagas são indicadas pelas próprias instituições; a previsão é uma estimativa, não uma garantia.">
            <div role="radiogroup" aria-label="Disponibilidade" className="grid gap-2.5">
              {(
                [
                  [null, 'Mostrar todas', 'Inclui as que só têm lista de espera.'],
                  ['agora', 'Com vaga agora', 'Pelo menos um lugar livre neste momento.'],
                  ['breve', 'Vaga agora ou em breve', 'Inclui vaga provável nos próximos 3 meses.'],
                ] as [VagaFiltro | null, string, string][]
              ).map(([v, label, desc]) => (
                <ChoiceCard
                  key={label}
                  name="disp"
                  checked={r.vaga === v}
                  onChange={() => set({ vaga: v })}
                  label={label}
                  description={desc}
                  icon={v ? <DispGlyph disp={v === 'agora' ? 'disponivel' : 'breve'} /> : undefined}
                />
              ))}
            </div>
          </Secao>
        )}

        {todos && (
          <Secao titulo="Tipo de resposta">
            <div className="grid gap-1">
              {TIPOS.map((t) => (
                <Checkbox key={t} checked={r.tipos.includes(t)} onChange={() => set({ tipos: toggle(r.tipos, t) })} label={TIPO_LABEL[t]} description={TIPO_RESUMO[t]} />
              ))}
            </div>
          </Secao>
        )}

        {todos && (
          <Secao titulo="Orçamento">
            <BudgetSlider value={r.max} onChange={(max) => set({ max })} precos={precos} />
          </Secao>
        )}

        {todos && centro && (
          <Secao titulo="Distância máxima">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Raio de pesquisa">
              {opcoesRaio(state.local).map((km) => (
                <button key={km} type="button" role="radio" aria-checked={r.raio === km} onClick={() => set({ raio: km })} className={chipClasses(r.raio === km, 'tabular')}>
                  {km} km
                </button>
              ))}
            </div>
          </Secao>
        )}

        <Secao titulo="Grau de dependência" ajuda="Mostra só as instituições que aceitam pessoas com este grau.">
          <div role="radiogroup" aria-label="Grau de dependência" className="grid gap-2.5 sm:grid-cols-2">
            <ChoiceCard name="grau" checked={r.grau == null} onChange={() => set({ grau: null })} label="Qualquer grau" description="Não filtrar por dependência." />
            {GRAUS_ORDEM.map((g: GrauDependencia) => (
              <ChoiceCard key={g} name="grau" checked={r.grau === g} onChange={() => set({ grau: g })} label={GRAU_LABEL[g]} description={GRAU_DESCRICAO[g]} />
            ))}
          </div>
        </Secao>

        <Secao titulo="Cuidados de saúde" ajuda="A instituição tem de assegurar todos os que escolher.">
          <div className="grid gap-x-4 sm:grid-cols-2">
            {CUIDADOS_ORDEM.map((c: Cuidado) => {
              const Icon = CUIDADO_ICON[c]
              return (
                <Checkbox
                  key={c}
                  checked={r.cuidados.includes(c)}
                  onChange={() => set({ cuidados: toggle(r.cuidados, c) })}
                  label={
                    <span className="inline-flex items-center gap-2">
                      <Icon aria-hidden className="size-5 shrink-0 text-pine-700" />
                      {CUIDADO_LABEL[c]}
                    </span>
                  }
                  description={CUIDADOS_CRITICOS.includes(c) ? 'Essencial para muitos perfis' : undefined}
                />
              )
            })}
          </div>
        </Secao>

        <Secao titulo="Comparticipação">
          <Switch
            checked={r.ss}
            onChange={(ss) => set({ ss })}
            label="Só com acordo da Segurança Social"
            description="Vagas comparticipadas: a mensalidade é calculada a partir dos rendimentos do agregado."
          />
        </Secao>

        <Secao titulo="Natureza da instituição">
          <div className="grid gap-1">
            {NATUREZAS.map((nat) => (
              <Checkbox
                key={nat}
                checked={r.naturezas.includes(nat)}
                onChange={() => set({ naturezas: toggle(r.naturezas, nat) })}
                label={NATUREZA_LABEL[nat]}
                description={NATUREZA_RESUMO[nat]}
              />
            ))}
          </div>
        </Secao>
      </div>
    </Modal>
  )
}
