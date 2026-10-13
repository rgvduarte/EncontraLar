import { useEffect, useId, useState, type ReactNode } from 'react'
import type { Cuidado, Natureza, TipoResposta } from '@/types'
import { ACESSO_DISPONIVEL } from '@/components/acesso'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Switch } from '@/components/ui/Field'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM, NATUREZA_LABEL, TIPO_LABEL, TIPO_RESUMO } from '@/lib/labels'
import { BudgetFaixas, BudgetSlider } from './BudgetControl'
import { PilulaBloqueada, RadioPills, TogglePill } from './Chips'
import { useNumeroAnimado } from './motion'
import { centroDe, FILTROS_VAZIOS, filtrosDe, NATUREZAS, opcoesRaio, TIPOS, VAGA_LABEL, type Filtros, type SearchState } from './searchState'

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
  /**
   * Camada completa (Acesso Família). Na versão grátis a disponibilidade fica à vista mas fechada
   * (`onBloqueado` abre o convite) e o orçamento vai por faixas.
   */
  completo?: boolean
  /** versão grátis: tocou num filtro fechado; recebe o rascunho com esse filtro, para voltar com tudo aplicado */
  onBloqueado?: (patch: Partial<SearchState>) => void
}

/** Secção da folha; as primeiras assentam em cascata quando a folha abre (--i = ordem). */
function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="el-secao">
      <legend className="text-lg font-semibold tracking-tight text-ink">{titulo}</legend>
      {ajuda && <div className="mt-0.5 text-sm text-ink-mute">{ajuda}</div>}
      <div className="mt-4">{children}</div>
    </fieldset>
  )
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** O que é cada tipo, em linguagem simples: só o escolhido, ou os três (um por linha). */
function AjudaTipo({ tipos }: { tipos: TipoResposta[] }) {
  const lista = tipos.length === 1 ? tipos : TIPOS
  return (
    <span className="flex flex-col">
      {lista.map((t) => (
        <span key={t}>
          <span className="font-medium text-ink-soft">{TIPO_LABEL[t]}:</span> {minuscula(TIPO_RESUMO[t])}
        </span>
      ))}
    </span>
  )
}

const AJUDA_NATUREZA = 'IPSS e Misericórdia: sem fins lucrativos, mensalidade conforme os rendimentos. Privado: preço fixo por tipo de quarto.'

/** "Mais filtros" (desktop) ou todos os filtros (telemóvel, folha inferior), com contagem ao vivo. */
export function FiltersModal({ open, onClose, modo, state, contar, precos, onApply, completo = true, onBloqueado }: Props) {
  const inicial = (): Rascunho => ({ ...filtrosDe(state), raio: state.raio })
  const [r, setR] = useState<Rascunho>(inicial)
  useEffect(() => {
    if (open) setR(inicial())
    // repõe o rascunho de cada vez que abre
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Rascunho>) => setR((x) => ({ ...x, ...patch }))
  const n = contar(r)
  // o número do botão desliza à medida que se escolhem filtros (o leitor de ecrã ouve o valor final)
  const nVisivel = useNumeroAnimado(n, 380)
  const todos = modo === 'todos'
  const centro = centroDe(state.local)
  const fechado = useId()

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
            <span aria-hidden className="tabular">
              {n === 0 ? 'Nenhum resultado' : n === 1 ? 'Ver 1 resultado' : `Ver ${nVisivel} resultados`}
            </span>
            <span className="sr-only" aria-live="polite">
              {n === 0 ? 'Nenhum resultado' : n === 1 ? 'Ver 1 resultado' : `Ver ${n} resultados`}
            </span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-10 pb-2 [&>*:nth-child(2)]:[--i:1] [&>*:nth-child(3)]:[--i:2] [&>*:nth-child(4)]:[--i:3] [&>*:nth-child(n+5)]:[--i:4]">
        {todos && !completo && (
          <Secao titulo="Disponibilidade" ajuda="Mostramos todas as instituições. Filtrar por vaga está disponível com o Acesso Família.">
            <div className="flex flex-wrap gap-2">
              <PilulaBloqueada descricao={fechado} onClick={() => onBloqueado?.({ ...r, vaga: 'agora' })}>
                {VAGA_LABEL.agora}
              </PilulaBloqueada>
              <PilulaBloqueada descricao={fechado} onClick={() => onBloqueado?.({ ...r, vaga: 'breve' })}>
                {VAGA_LABEL.breve}
              </PilulaBloqueada>
              <span id={fechado} hidden>
                {ACESSO_DISPONIVEL}
              </span>
            </div>
          </Secao>
        )}

        {todos && completo && (
          <Secao titulo="Disponibilidade" ajuda="Vagas indicadas pelas instituições; «em breve» é uma previsão.">
            <RadioPills
              value={r.vaga}
              onChange={(vaga) => set({ vaga })}
              opcoes={[
                { v: null, label: 'Todas' },
                { v: 'agora', label: VAGA_LABEL.agora },
                { v: 'breve', label: VAGA_LABEL.breve },
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
          <Secao titulo="Tipo" ajuda={<AjudaTipo tipos={r.tipos} />}>
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
          <Secao titulo="Orçamento" ajuda={completo ? undefined : 'Por faixas de mensalidade, como nas fichas.'}>
            {completo ? (
              <BudgetSlider value={r.max} onChange={(max) => set({ max })} precos={precos} />
            ) : (
              <BudgetFaixas value={r.max} onChange={(max) => set({ max })} />
            )}
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

        <Secao titulo="Natureza" ajuda={AJUDA_NATUREZA}>
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
