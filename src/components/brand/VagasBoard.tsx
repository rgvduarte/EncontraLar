import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Pause, Play } from 'lucide-react'
import type { Distrito, Lar } from '@/types'
import { vagaParaNovos, vagasLivres } from '@/lib/forecast'
import { num, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { useMediaQuery } from '@/lib/hooks'
import { resumoDisponibilidade } from '@/lib/acesso'
import { useAcesso } from '@/lib/store'
import { AvisoAcesso } from '@/components/acesso'
import { cn } from '@/lib/cn'

interface VagasBoardProps {
  lares: Lar[]
  linhas?: number
  className?: string
  /** título da lista com nomes (versão completa) */
  titulo?: string
  theme?: 'light' | 'dark'
}

/**
 * Vagas no país. Com Acesso Família (ou para profissionais): a lista "em direto" das instituições que atualizaram
 * vagas há menos tempo. Na versão grátis: só os números por distrito (o "quantas", nunca o "quais"), sem nomes.
 */
export function VagasBoard(props: VagasBoardProps) {
  const { completo } = useAcesso()
  return completo ? <ListaAoVivo {...props} /> : <ResumoPorDistrito {...props} />
}

/** Lista "em direto" das vagas atualizadas mais recentemente pelas instituições (roda devagar). */
function ListaAoVivo({ lares, linhas = 5, className, titulo = 'Atualizadas agora', theme = 'light' }: VagasBoardProps) {
  const comVaga = useMemo(
    // só vagas para quem pede hoje (um lugar livre já prometido à lista de espera não entra no "com vaga")
    () => lares.filter((l) => l.tipo !== 'centro_dia' && vagaParaNovos(l)).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
    [lares],
  )
  const lista = useMemo(() => comVaga.slice(0, 15), [comVaga])
  const [offset, setOffset] = useState(0)
  // pausa enquanto o ponteiro ou o foco estão na lista (a linha não muda debaixo do clique), com o separador
  // escondido e quando a pessoa a para no botão (WCAG 2.2.2 — também para quem usa toque)
  const [pausado, setPausado] = useState(false)
  const [parado, setParado] = useState(false)
  const reduzido = useMediaQuery('(prefers-reduced-motion: reduce)')
  const roda = lista.length > linhas && !reduzido
  const [escondido, setEscondido] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const onVis = () => setEscondido(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    if (!roda || pausado || parado || escondido) return
    const t = setInterval(() => setOffset((o) => (o + 1) % lista.length), 4500)
    return () => clearInterval(t)
  }, [roda, lista.length, pausado, parado, escondido])
  const visiveis = Array.from({ length: Math.min(linhas, lista.length) }, (_, i) => lista[(offset + i) % lista.length]!)
  const dark = theme === 'dark'

  return (
    <section
      aria-label={titulo}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausado(false)
      }}
      className={cn('overflow-hidden rounded-[1.75rem]', dark ? 'bg-pine-800 text-white' : 'bg-white ring-1 ring-line', className)}
    >
      <header className="flex items-center gap-3 px-6 pt-5 pb-3">
        <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-500 opacity-60 [animation-iteration-count:3] motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-leaf-500" />
          </span>
          {titulo}
        </p>
        <span className={cn('text-xs', dark ? 'text-pine-300' : 'text-ink-mute')}>{comVaga.length} com vaga</span>
        {roda && (
          <button
            type="button"
            onClick={() => setParado((p) => !p)}
            aria-label={parado ? 'Retomar a lista' : 'Pausar a lista'}
            className={cn(
              '-my-3 -mr-3 flex size-12 items-center justify-center rounded-full transition-colors',
              dark ? 'text-pine-300 hover:bg-white/8 hover:text-white' : 'text-ink-mute hover:bg-sand hover:text-ink',
            )}
          >
            {parado ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
          </button>
        )}
      </header>
      <ol aria-live="off" className="px-2 pb-2">
        {visiveis.map((l, i) => {
          const q = l.quartos.find((x) => x.livres > 0)
          const n = vagasLivres(l)
          return (
            <li key={`${l.id}-${(offset + i) % lista.length}`} className="animate-fade-in">
              <Link
                to={`/lar/${l.id}`}
                className={cn('group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors', dark ? 'hover:bg-white/8' : 'hover:bg-sand')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{l.nome}</span>
                  <span className={cn('block truncate text-sm', dark ? 'text-pine-400' : 'text-ink-mute')}>
                    {l.localidade} · {q ? QUARTO_CURTO[q.tipo].toLowerCase() : ''} · {tempoRelativo(l.atualizadoEm)}
                  </span>
                </span>
                <span className={cn('shrink-0 text-sm font-semibold tabular', dark ? 'text-leaf-200' : 'text-leaf-700')}>
                  {n} {n === 1 ? 'vaga' : 'vagas'}
                </span>
                <ChevronRight aria-hidden className={cn('size-4 shrink-0', dark ? 'text-pine-500' : 'text-ink-mute/60')} />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Distritos com menos instituições do que isto não aparecem sozinhos: com 1 ou 2 casas, "1 com vaga" diria qual é.
 * Contam no total do país.
 */
const MIN_POR_DISTRITO = 5

/** Versão grátis: quantas casas têm vaga agora em cada distrito (sem nomes), e onde ver quais são. */
function ResumoPorDistrito({ lares, linhas = 5, className, theme = 'light' }: VagasBoardProps) {
  const { distritos, total } = useMemo(() => {
    // as mesmas regras da lista completa: só lares e residências, vaga para quem pede hoje (vagaParaNovos)
    const residenciais = lares.filter((l) => l.tipo !== 'centro_dia')
    const por = new Map<Distrito, Lar[]>()
    for (const l of residenciais) por.set(l.distrito, [...(por.get(l.distrito) ?? []), l])
    const distritos = [...por]
      .filter(([, ls]) => ls.length >= MIN_POR_DISTRITO)
      .map(([distrito, ls]) => ({ distrito, ...resumoDisponibilidade(ls) }))
      .filter((d) => d.comVaga > 0)
      .sort((a, b) => b.comVaga - a.comVaga || b.total - a.total || a.distrito.localeCompare(b.distrito, 'pt'))
    return { distritos, total: resumoDisponibilidade(residenciais).comVaga }
  }, [lares])
  const visiveis = distritos.slice(0, linhas)
  const dark = theme === 'dark'
  const titulo = 'Com vaga agora, por distrito'

  return (
    <section aria-label={titulo} className={cn('overflow-hidden rounded-[1.75rem]', dark ? 'bg-pine-800 text-white' : 'bg-white ring-1 ring-line', className)}>
      <header className="flex items-center gap-3 px-6 pt-5 pb-3">
        <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-leaf-500" />
          {titulo}
        </p>
        {/* <p> e não <span>: a página inicial esconde o contador da lista completa (header>span) */}
        <p className={cn('text-xs tabular', dark ? 'text-pine-300' : 'text-ink-mute')}>{num(total)} no país</p>
      </header>
      {visiveis.length > 0 ? (
        <ol className="px-2 pb-1">
          {visiveis.map((d) => (
            <li key={d.distrito}>
              <Link
                to={`/pesquisa?distrito=${encodeURIComponent(d.distrito)}`}
                className={cn('group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors', dark ? 'hover:bg-white/8' : 'hover:bg-sand')}
              >
                {/* a contagem na linha do nome; o total numa linha inteira (no telemóvel não cabia ao lado) */}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{d.distrito}</span>
                    <span className={cn('shrink-0 text-sm font-semibold tabular', dark ? 'text-leaf-200' : 'text-leaf-700')}>{num(d.comVaga)} com vaga</span>
                  </span>
                  <span className={cn('block truncate text-sm', dark ? 'text-pine-400' : 'text-ink-mute')}>
                    de {num(d.total)} lares e residências
                  </span>
                </span>
                <ChevronRight aria-hidden className={cn('size-4 shrink-0', dark ? 'text-pine-500' : 'text-ink-mute/60')} />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn('px-6 pb-3', dark ? 'text-pine-300' : 'text-ink-mute')}>Neste momento não há lugares livres registados.</p>
      )}
      <AvisoAcesso
        texto="Que instituições têm vaga e quantos lugares"
        className={cn('mx-6 border-t pt-1 pb-2', dark ? 'border-white/10 text-pine-300 [&_a]:text-terra-300 [&_a:hover]:text-white' : 'border-line')}
      />
    </section>
  )
}
