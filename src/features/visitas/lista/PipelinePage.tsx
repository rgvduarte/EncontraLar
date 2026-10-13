import { useEffect, useId, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { ArrowDownAZ, ChevronDown, ClipboardCheck, ClipboardList, LocateFixed, MapPin, Search, SearchX, X } from 'lucide-react'
import type { Distrito } from '@/types'
import { useLares, useVisitas } from '@/lib/store'
import { useDebounced, useDocumentTitle } from '@/lib/hooks'
import { noDistrito } from '@/lib/labels'
import { plural } from '@/lib/format'
import { DISTRITOS } from '@/data/localidades'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { Segmented } from '@/features/lar-dashboard/shared/Segmented'
import { useAgora } from '@/features/lar-dashboard/lib/hooks'
import { InlineSpinner } from '@/features/auth/shared/InlineSpinner'
import { linhasDoDistrito, pesquisar, resumoDoMes, SEGMENTO_LABEL, SEGMENTOS, separarSegmentos, type FiltroDistrito, type Segmento } from '../pipeline'
import { laresComRascunho } from '../rascunho'
import { usePosicao, type EstadoPosicao } from '../usePosicao'
import { distritoDosParams, guardarDistrito, lembrarLista, segmentoDosParams } from './params'
import { LinhaLar } from './LinhaLar'
import { Resumo } from './Resumo'

// os mesmos contornos dos campos do kit (pine-400: o limite do campo chega a 3:1 sobre branco)
const CAMPO =
  'min-h-13 w-full rounded-2xl border border-pine-400 bg-white text-base text-ink placeholder:text-ink-mute transition-[border-color,box-shadow] ' +
  'hover:border-pine-500 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none'

const ORDEM: Record<Segmento, string> = {
  por_visitar: 'por ordem alfabética',
  acompanhar: 'pela data do próximo contacto',
  aderiram: 'a visita mais recente primeiro',
  recusaram: 'a visita mais recente primeiro',
}

function ordemPorVisitar(estado: EstadoPosicao): string {
  if (estado === 'ativo') return 'da mais perto para a mais longe'
  if (estado === 'negado') return 'por ordem alfabética (sem acesso à localização)'
  if (estado === 'indisponivel') return 'por ordem alfabética (localização indisponível)'
  return ORDEM.por_visitar
}

/**
 * Pipeline da equipa (/visitas): números do mês, distrito e pesquisa, e os quatro segmentos.
 * O segmento, o distrito e a pesquisa vivem no endereço: voltar de uma visita reabre a mesma vista.
 */
export default function PipelinePage() {
  useDocumentTitle('Visitas')
  const lares = useLares()
  const visitas = useVisitas()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const distrito = distritoDosParams(params)
  const segmento = segmentoDosParams(params)
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const qDeb = useDebounced(q, 160)
  const agoraMs = useAgora()
  const agora = useMemo(() => new Date(agoraMs), [agoraMs])
  const posicao = usePosicao()
  // rascunhos deste separador (lidos ao abrir a lista: o formulário grava-os enquanto está aberto)
  const [rascunhos] = useState(laresComRascunho)
  const ids = { distrito: useId(), pesquisa: useId() }

  const linhas = useMemo(() => linhasDoDistrito(lares, visitas, distrito, agora), [lares, visitas, distrito, agora])
  const resumo = useMemo(() => resumoDoMes(linhas, agora), [linhas, agora])
  const segmentos = useMemo(() => separarSegmentos(pesquisar(linhas, qDeb), posicao.origem), [linhas, qDeb, posicao.origem])
  const lista = segmentos[segmento]
  const porDistrito = useMemo(() => {
    const m = new Map<Distrito, number>()
    for (const l of lares) m.set(l.distrito, (m.get(l.distrito) ?? 0) + 1)
    return m
  }, [lares])
  const atrasados = segmentos.acompanhar.filter((l) => l.contacto?.tipo === 'atrasado').length
  const visitasNoDistrito = linhas.some((l) => l.visitas.length > 0)
  const procura = qDeb.trim()

  // a pesquisa segue para o endereço (sem entrar no histórico)
  useEffect(() => {
    const atual = params.get('q') ?? ''
    if (atual === procura) return
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (procura) n.set('q', procura)
        else n.delete('q')
        return n
      },
      { replace: true },
    )
  }, [procura, params, setParams])

  // a vista atual, para "Próxima visita" voltar aqui
  useEffect(() => lembrarLista(location.search), [location.search])

  const mudar = (k: 'seg' | 'distrito', v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v == null) n.delete(k)
        else n.set(k, v)
        return n
      },
      { replace: true },
    )

  const escolherDistrito = (d: FiltroDistrito) => {
    guardarDistrito(d)
    mudar('distrito', d)
  }

  const onde = distrito === 'todos' ? 'em todos os distritos' : noDistrito(distrito)
  const ordem = segmento === 'por_visitar' ? ordemPorVisitar(posicao.estado) : ORDEM[segmento]

  return (
    <div className="flex flex-col gap-10">
      <Resumo r={resumo} distrito={distrito} agora={agora} />

      <section aria-labelledby="pipeline-titulo" className="flex flex-col gap-5">
        <h2 id="pipeline-titulo" className="sr-only">
          Instituições {onde}
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-72 sm:shrink-0">
            <label htmlFor={ids.distrito} className="sr-only">
              Distrito
            </label>
            <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-mute" />
            <select
              id={ids.distrito}
              value={distrito}
              onChange={(e) => escolherDistrito(e.target.value as FiltroDistrito)}
              className={cn(CAMPO, 'cursor-pointer appearance-none py-3 pr-12 pl-12 font-medium')}
            >
              {DISTRITOS.map((d) => (
                <option key={d} value={d}>
                  {d} ({porDistrito.get(d) ?? 0})
                </option>
              ))}
              <option value="todos">Todos os distritos ({lares.length})</option>
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-soft" />
          </div>
          <div className="relative flex-1">
            <label htmlFor={ids.pesquisa} className="sr-only">
              Procurar por nome ou localidade
            </label>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-mute" />
            <input
              id={ids.pesquisa}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou localidade"
              autoComplete="off"
              enterKeyHint="search"
              className={cn(CAMPO, 'py-3 pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden')}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Limpar pesquisa"
                className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-mute hover:bg-sand hover:text-ink"
              >
                <X aria-hidden className="size-5" />
              </button>
            )}
          </div>
        </div>

        <Segmented<Segmento>
          label="Fase das instituições"
          valor={segmento}
          onChange={(s) => mudar('seg', s === 'por_visitar' ? null : s)}
          itens={SEGMENTOS.map((s) => ({
            id: s,
            label: SEGMENTO_LABEL[s],
            n: segmentos[s].length,
            destaque: s === 'acompanhar' && atrasados > 0,
            marca: s === 'acompanhar' && atrasados > 0 ? `${atrasados} em atraso` : undefined,
          }))}
        />

        {/* a contagem é anunciada ao mudar de segmento, distrito ou pesquisa (vazia: só para o leitor de ecrã) */}
        <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', lista.length > 0 ? 'min-h-11' : '-mt-5')}>
          <p aria-live="polite" className={cn('text-ink-mute', !lista.length && 'sr-only')}>
            {lista.length > 0 ? (
              <>
                <span className="font-medium text-ink">{plural(lista.length, 'instituição', 'instituições')}</span> · {ordem}
              </>
            ) : (
              'Nenhuma instituição nesta lista.'
            )}
          </p>
          {segmento === 'por_visitar' && posicao.suportado && segmentos.por_visitar.length > 1 && (
            posicao.estado === 'ativo' ? (
              <Button variant="subtle" size="sm" className="min-h-11" icon={<ArrowDownAZ aria-hidden />} onClick={posicao.alfabetica}>
                Ordenar A–Z
              </Button>
            ) : posicao.estado === 'a_pedir' ? (
              <Button variant="subtle" size="sm" className="min-h-11" disabled aria-busy icon={<InlineSpinner className="size-4" />}>
                A localizar…
              </Button>
            ) : (
              <Button variant="subtle" size="sm" className="min-h-11" icon={<LocateFixed aria-hidden />} onClick={posicao.localizar}>
                Ordenar por distância
              </Button>
            )
          )}
        </div>

        {lista.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {lista.map((l) => (
              <LinhaLar key={l.lar.id} linha={l} agora={agora} rascunho={rascunhos.has(l.lar.id)} />
            ))}
          </ul>
        ) : (
          <Vazio
            segmento={segmento}
            distrito={distrito}
            semInstituicoes={linhas.length === 0}
            semVisitas={!visitasNoDistrito}
            procura={procura}
            limpar={() => setQ('')}
            irPara={(s) => mudar('seg', s === 'por_visitar' ? null : s)}
          />
        )}
      </section>
    </div>
  )
}

/** Estados vazios: distrito sem instituições, pesquisa sem resultados, ainda sem visitas, todas visitadas. */
function Vazio({
  segmento,
  distrito,
  semInstituicoes,
  semVisitas,
  procura,
  limpar,
  irPara,
}: {
  segmento: Segmento
  distrito: FiltroDistrito
  semInstituicoes: boolean
  semVisitas: boolean
  procura: string
  limpar: () => void
  irPara: (s: Segmento) => void
}) {
  // "… no distrito do Porto" (sem sufixo com todos os distritos)
  const no = distrito === 'todos' ? '' : ` ${noDistrito(distrito)}`
  if (semInstituicoes) {
    return (
      <EmptyState
        icon={<MapPin />}
        title={`Ainda não há instituições${no}`}
        text="Escolha outro distrito no seletor acima."
      />
    )
  }
  if (procura) {
    return (
      <EmptyState
        icon={<SearchX />}
        title={`Nenhuma instituição com «${procura}»`}
        text={`Em «${SEGMENTO_LABEL[segmento]}». Experimente outro nome ou outra localidade.`}
        action={
          <Button variant="inverse" onClick={limpar}>
            Limpar pesquisa
          </Button>
        }
      />
    )
  }
  if (segmento === 'por_visitar') {
    return (
      <EmptyState
        icon={<ClipboardCheck />}
        title={`Já visitou todas as instituições${no}`}
        text="As que ficaram por decidir estão em «A acompanhar»."
        action={
          <Button variant="inverse" onClick={() => irPara('acompanhar')}>
            Ver a acompanhar
          </Button>
        }
      />
    )
  }
  if (semVisitas) {
    return (
      <EmptyState
        icon={<ClipboardList />}
        title={`Ainda não há visitas${no}`}
        text="Comece pelas instituições por visitar. Cada visita registada aparece aqui, conforme o resultado."
        action={
          <Button variant="inverse" onClick={() => irPara('por_visitar')}>
            Ver por visitar
          </Button>
        }
      />
    )
  }
  const textos: Record<Exclude<Segmento, 'por_visitar'>, { titulo: string; texto: string }> = {
    acompanhar: { titulo: 'Ninguém a acompanhar', texto: 'Quem ficar interessado ou pedir para voltar mais tarde aparece aqui, pela data do próximo contacto.' },
    aderiram: { titulo: `Ainda nenhuma adesão${no}`, texto: 'As instituições que aderirem aparecem aqui, com a modalidade escolhida.' },
    recusaram: { titulo: 'Nenhuma recusa', texto: 'Quem recusar fica aqui, para voltar a tentar mais tarde.' },
  }
  const t = textos[segmento]
  return <EmptyState icon={<ClipboardList />} title={t.titulo} text={t.texto} />
}
