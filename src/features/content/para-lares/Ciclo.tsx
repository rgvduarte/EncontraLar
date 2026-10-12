/**
 * "Da saída à nova entrada" — a cena presa (sticky) da página /para-lares.
 * Três tempos contados com o scroll: (1) saiu um residente → a vaga sobe +1 no painel,
 * (2) as famílias certas são avisadas → chegam as notificações e o contador sobe,
 * (3) a vaga é preenchida → a ocupação volta a encher e a lista de espera encurta.
 * Desktop: texto à esquerda (o tempo atual destacado), interface à direita.
 * Telemóvel: o mesmo, empilhado (tempo atual por cima, interface por baixo) e mais curto.
 * Movimento reduzido: os três tempos aparecem empilhados, já no estado final.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { BellRing, Check, Minus, Plus } from 'lucide-react'
import type { Candidatura, Lar, RoomOffer } from '@/types'
import { useCandidaturasDoLar, useDB } from '@/lib/store'
import { useMediaQuery } from '@/lib/hooks'
import { easeInOut, easeOut, mix, range, usePrefersReducedMotion } from '@/lib/motion'
import { num, pct, plural } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { LogoMark } from '@/components/layout/Logo'
import { CountUp, Reveal, StickyScene } from '@/components/motion'
import { cn } from '@/lib/cn'
import { familiasAAvisar, nomeCurto } from './ensaio'

/** "quarto individual", "quarto duplo", "quarto para casal" */
const quartoMin = (q: Pick<RoomOffer, 'tipo'>) => QUARTO_LABEL[q.tipo].replace(' (partilhado)', '').toLowerCase()

const TEMPOS = [
  { t: 'Saiu um residente.', d: 'Um toque no painel e a vaga aparece no mapa, no mesmo instante. Ninguém precisa de telefonar.' },
  { t: 'As famílias certas são avisadas.', d: 'Quem está na lista de espera ou segue a casa recebe o aviso, com o perfil clínico já comparado.' },
  { t: 'A vaga é preenchida em dias, não meses.', d: 'A primeira família tem 48 horas para responder. Se não puder, a vaga passa à seguinte.' },
] as const
const N = TEMPOS.length

// ————————————————————————————————————————————————— dados do exemplo

interface Dados {
  lar: Lar
  /** o tipo de quarto onde "sai" um residente (de preferência um que esteja cheio) */
  quarto: RoomOffer
  avisadas: number
  lista: Candidatura[]
}

function useDados(lar: Lar): Dados | null {
  const db = useDB()
  const cands = useCandidaturasDoLar(lar.id)
  return useMemo(() => {
    const quarto = lar.quartos.find((q) => q.livres === 0) ?? lar.quartos[0]
    if (!quarto) return null
    const lista = cands
      .filter((c) => c.estado === 'lista_espera')
      .sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99))
      .slice(0, 4)
    return { lar, quarto, avisadas: Math.max(familiasAAvisar(db, lar), lista.length), lista }
  }, [db, lar, cands])
}

// ————————————————————————————————————————————————— peças de interface (decorativas, aria-hidden)

/** Moldura do painel: cabeçalho fixo e corpo onde os tempos se sucedem. */
function Painel({ lar, children, className }: { lar: Lar; children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn('overflow-hidden rounded-[1.75rem] bg-white text-ink shadow-lift sm:rounded-[2rem]', className)}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 sm:px-6 sm:py-4">
        <LogoMark className="size-7 shrink-0 sm:size-8" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold sm:text-lg">{lar.nome}</p>
          <p className="text-xs text-ink-mute sm:text-sm">Painel da instituição</p>
        </div>
      </div>
      {children}
    </div>
  )
}

/** Tempo 1 — o "+" é tocado e o número rola de n para n+1. */
function UiVaga({ d, t }: { d: Dados; t: number }) {
  const toque = range(t, 0.18, 0.5)
  const rola = easeInOut(range(t, 0.38, 0.6))
  const publicado = easeOut(range(t, 0.62, 0.85))
  const antes = d.quarto.livres
  return (
    <div className="flex h-full flex-col px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-sm font-semibold">Vagas agora</p>
      <ul className="mt-1 divide-y divide-line">
        {d.lar.quartos.slice(0, 3).map((q) => {
          const alvo = q.tipo === d.quarto.tipo
          return (
            <li key={q.tipo} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{QUARTO_CURTO[q.tipo]}</p>
                <p className="text-sm text-ink-mute tabular">{num(q.total)} lugares</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="flex size-10 items-center justify-center rounded-full bg-sand text-ink-mute sm:size-11">
                  <Minus className="size-4.5" strokeWidth={1.75} />
                </span>
                <span className="relative h-9 w-10 overflow-hidden text-center text-[1.75rem] leading-9 font-semibold tabular">
                  {alvo ? (
                    <span className="absolute inset-x-0 top-0 flex flex-col will-change-transform" style={{ transform: `translate3d(0, ${-rola * 2.25}rem, 0)` }}>
                      <span className={antes > 0 ? 'text-leaf-600' : 'text-ink-mute'}>{antes}</span>
                      <span className="text-leaf-600">{antes + 1}</span>
                    </span>
                  ) : (
                    <span className={q.livres > 0 ? 'text-leaf-600' : 'text-ink-mute'}>{q.livres}</span>
                  )}
                </span>
                <span className="relative flex size-10 items-center justify-center rounded-full bg-sand sm:size-11">
                  {alvo && (
                    <>
                      {/* o "dedo": um círculo que carrega e se desvanece */}
                      <span
                        className="absolute inset-0 rounded-full bg-terra-600/25"
                        style={{ opacity: toque > 0 && toque < 1 ? 1 - toque : 0, transform: `scale(${mix(0.6, 1.9, toque)})` }}
                      />
                      <span
                        className="absolute inset-0 rounded-full bg-ink"
                        style={{ opacity: toque > 0.15 && toque < 0.7 ? 1 : 0, transform: `scale(${toque > 0.15 && toque < 0.7 ? 0.92 : 1})`, transition: 'opacity .2s, transform .2s' }}
                      />
                    </>
                  )}
                  <Plus className={cn('relative size-4.5 transition-colors duration-200', alvo && toque > 0.15 && toque < 0.7 && 'text-white')} strokeWidth={1.75} />
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto pt-3">
        <p
          className="flex items-center gap-2.5 rounded-2xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-700"
          style={{ opacity: publicado, transform: `translate3d(0, ${(1 - publicado) * 12}px, 0)` }}
        >
          <span className="size-2 shrink-0 rounded-full bg-leaf-500" />
          Publicada no mapa · agora mesmo
        </p>
      </div>
    </div>
  )
}

/** Tempo 2 — as notificações chegam uma a uma; o contador sobe. */
function UiAviso({ d, t, ativo }: { d: Dados; t: number; ativo: boolean }) {
  const nomes = d.lista.length ? d.lista.slice(0, 3).map((c) => nomeCurto(c.perfil.nome)) : ['Família 1', 'Família 2', 'Família 3']
  return (
    <div className="flex h-full flex-col px-5 py-4 sm:px-6 sm:py-5">
      <p className="flex items-baseline gap-2">
        <span className="text-[2.75rem] leading-none font-semibold tracking-tight tabular">
          {ativo ? <CountUp value={d.avisadas} duration={1100} /> : 0}
        </span>
        <span className="text-lg text-ink-mute">{d.avisadas === 1 ? 'família avisada' : 'famílias avisadas'}</span>
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {nomes.map((nome, i) => {
          const k = easeOut(range(t, 0.08 + i * 0.16, 0.34 + i * 0.16))
          return (
            <li
              key={nome + i}
              className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 will-change-transform"
              style={{ opacity: k, transform: `translate3d(0, ${(1 - k) * 28}px, 0) scale(${mix(0.96, 1, k)})` }}
            >
              <LogoMark className="mt-0.5 size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2 text-xs text-ink-mute">
                  <span className="truncate">Para {nome}</span>
                  <span className="shrink-0">agora</span>
                </p>
                <p className="truncate text-sm font-semibold">Abriu vaga: {quartoMin(d.quarto)}</p>
              </div>
            </li>
          )
        })}
      </ul>
      {d.avisadas > nomes.length && (
        <p className="mt-auto pt-3 text-sm text-ink-mute" style={{ opacity: easeOut(range(t, 0.62, 0.8)) }}>
          e mais {plural(d.avisadas - nomes.length, 'família', 'famílias')}
        </p>
      )}
    </div>
  )
}

/** Tempo 3 — a primeira família aceita, sai da lista, e a ocupação volta a encher. */
function UiPreenchida({ d, t }: { d: Dados; t: number }) {
  const aceita = range(t, 0.12, 0.3)
  const sai = easeInOut(range(t, 0.34, 0.6))
  const enche = easeOut(range(t, 0.45, 0.8))
  const fim = easeOut(range(t, 0.78, 0.95))
  const total = d.quarto.total
  const antes = Math.max(0, total - d.quarto.livres - 1)
  const depois = antes + 1
  const ocup = mix(antes, depois, enche) / Math.max(1, total)
  const linhas = d.lista.slice(0, 4)
  const naLista = Math.max(d.lar.listaEspera, linhas.length)
  return (
    <div className="flex h-full flex-col px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          Ocupação · {QUARTO_CURTO[d.quarto.tipo].toLowerCase()}
        </p>
        <p className="text-sm text-ink-mute tabular">
          {num(enche > 0.5 ? depois : antes)} de {num(total)}
        </p>
      </div>
      <p className="mt-1 text-[2.75rem] leading-none font-semibold tracking-tight tabular">{pct(ocup)}</p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sand-deep">
        <div className={cn('h-full origin-left rounded-full transition-colors duration-300', ocup >= 0.999 ? 'bg-leaf-500' : 'bg-ink')} style={{ transform: `scaleX(${ocup})` }} />
      </div>

      {linhas.length > 0 && (
        <div className="mt-5">
          <p className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Lista de espera</span>
            <span className="text-ink-mute tabular">{num(sai > 0.5 ? naLista - 1 : naLista)} pessoas</span>
          </p>
          <ol className="relative mt-1 h-[8.25rem] overflow-hidden sm:h-[9.75rem]">
            {linhas.map((c, i) => {
              const primeira = i === 0
              const y = i * 100 - sai * 100
              return (
                <li
                  key={c.id}
                  className="absolute inset-x-0 top-0 flex h-[2.75rem] items-center gap-3 border-t border-line will-change-transform sm:h-[3.25rem]"
                  style={{
                    transform: primeira ? `translate3d(${sai * 40}px, 0, 0)` : `translate3d(0, ${y}%, 0)`,
                    opacity: primeira ? 1 - sai : 1,
                  }}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand text-xs font-semibold">
                    {c.perfil.nome.trim()[0]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{nomeCurto(c.perfil.nome)}</span>
                  {primeira && (
                    <span
                      className="flex shrink-0 items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-semibold text-leaf-700"
                      style={{ opacity: aceita, transform: `scale(${mix(0.85, 1, aceita)})` }}
                    >
                      <Check className="size-3.5" strokeWidth={2.5} /> Aceitou
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <p
        className="mt-auto flex items-center gap-2 pt-3 text-sm font-semibold text-leaf-700"
        style={{ opacity: fim, transform: `translate3d(0, ${(1 - fim) * 10}px, 0)` }}
      >
        <Check className="size-4" strokeWidth={2.5} /> Vaga preenchida
      </p>
    </div>
  )
}

function Ui({ i, d, t, ativo }: { i: number; d: Dados; t: number; ativo: boolean }) {
  if (i === 0) return <UiVaga d={d} t={t} />
  if (i === 1) return <UiAviso d={d} t={t} ativo={ativo} />
  return <UiPreenchida d={d} t={t} />
}

// ————————————————————————————————————————————————— coreografia

const FADE = 0.035
/** visibilidade (0–1) do tempo i para o progresso p: cruza com o anterior e o seguinte */
function visivel(i: number, p: number) {
  const entra = i === 0 ? 1 : range(p, i / N - FADE, i / N + FADE)
  const sai = i === N - 1 ? 0 : range(p, (i + 1) / N - FADE, (i + 1) / N + FADE)
  return entra * (1 - sai)
}
/** progresso da ação dentro do tempo i (termina antes da transição para o seguinte) */
const acao = (i: number, p: number) => range(p, i / N + (i === 0 ? 0.02 : FADE), (i + 1) / N - FADE * 2)

/**
 * Estilo de uma camada que entra/sai com o progresso. As camadas de interface (decorativas) escondem-se
 * de todo quando invisíveis; as de texto ficam sempre na árvore de acessibilidade (o leitor de ecrã lê os três tempos).
 */
function camada(i: number, p: number, decorativa = true): CSSProperties {
  const v = visivel(i, p)
  const depois = p < i / N // ainda está para vir → entra por baixo; senão sai por cima
  return {
    opacity: v,
    transform: `translate3d(0, ${(1 - v) * (depois ? 28 : -28)}px, 0) scale(${mix(0.97, 1, v)})`,
    visibility: decorativa && v < 0.01 ? 'hidden' : undefined,
  }
}

function Cena({ d, p }: { d: Dados; p: number }) {
  // texto ao lado da interface a partir do tablet; empilhado no telemóvel
  const lado = useMediaQuery('(min-width: 768px)')
  const atual = Math.min(N - 1, Math.floor(p * N))

  const interface_ = (
    <Painel lar={d.lar} className="w-full">
      <div className="relative h-[21.5rem] sm:h-[25rem]">
        {TEMPOS.map((_, i) => (
          <div key={i} className="absolute inset-0 will-change-transform" style={camada(i, p)}>
            <Ui i={i} d={d} t={acao(i, p)} ativo={i <= atual} />
          </div>
        ))}
      </div>
    </Painel>
  )

  if (lado)
    return (
      <div className="container-page grid h-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-10 lg:gap-20">
        <div className="relative pl-8">
          {/* calha de progresso */}
          <span aria-hidden className="absolute top-1 bottom-1 left-0 w-0.5 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full origin-top rounded-full bg-white" style={{ transform: `scaleY(${p})` }} />
          </span>
          <ol className="flex flex-col gap-8 lg:gap-10">
            {TEMPOS.map((x, i) => (
              <li
                key={x.t}
                aria-current={i === atual ? 'step' : undefined}
                className={cn('transition-opacity duration-500 ease-[cubic-bezier(.16,1,.3,1)]', i === atual ? 'opacity-100' : 'opacity-30')}
              >
                <p className="text-sm font-semibold text-pine-400 tabular">0{i + 1}</p>
                <h3 className="mt-1 text-2xl font-semibold text-white lg:text-3xl xl:text-4xl">{x.t}</h3>
                <p className="mt-3 max-w-[36ch] text-base text-pine-300 lg:text-lg">{x.d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="mx-auto w-full max-w-[34rem]">{interface_}</div>
      </div>
    )

  // telemóvel / tablet: tempo atual por cima, interface por baixo
  return (
    <div className="container-page flex h-full flex-col justify-center gap-6 pt-2 pb-4">
      <div>
        <div aria-hidden className="flex gap-1.5">
          {TEMPOS.map((_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full origin-left rounded-full bg-white" style={{ transform: `scaleX(${range(p, i / N, (i + 1) / N)})` }} />
            </span>
          ))}
        </div>
        <ol className="relative mt-5 h-[12rem] sm:h-[9.5rem]">
          {TEMPOS.map((x, i) => (
            <li key={x.t} aria-current={i === atual ? 'step' : undefined} className="absolute inset-x-0 top-0" style={camada(i, p, false)}>
              <p className="text-sm font-semibold text-pine-400 tabular">
                0{i + 1} <span className="font-normal">de 0{N}</span>
              </p>
              <h3 className="mt-1 text-[1.75rem] leading-tight font-semibold text-white sm:text-3xl">{x.t}</h3>
              <p className="mt-2 text-base text-pine-300 sm:text-lg">{x.d}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="mx-auto w-full max-w-[30rem]">{interface_}</div>
    </div>
  )
}

/** Versão estática (movimento reduzido): os três tempos empilhados, cada um no estado final. */
function Empilhado({ d }: { d: Dados }) {
  return (
    <ol className="container-page flex flex-col gap-16 pb-20 sm:pb-28 lg:gap-24 lg:pb-40">
      {TEMPOS.map((x, i) => (
        <li key={x.t} className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div>
            <p className="text-sm font-semibold text-pine-400 tabular">0{i + 1}</p>
            <h3 className="mt-1 text-3xl font-semibold text-white xl:text-4xl">{x.t}</h3>
            <p className="mt-3 max-w-[36ch] text-lg text-pine-300">{x.d}</p>
          </div>
          <Painel lar={d.lar} className="mx-auto w-full max-w-[34rem]">
            <div className="h-[21.5rem] sm:h-[25rem]">
              <Ui i={i} d={d} t={1} ativo />
            </div>
          </Painel>
        </li>
      ))}
    </ol>
  )
}

export function Ciclo({ lar }: { lar: Lar }) {
  const d = useDados(lar)
  const reduced = usePrefersReducedMotion()
  const lado = useMediaQuery('(min-width: 768px)')
  if (!d) return null

  return (
    <div className="on-dark bg-pine-950 text-white">
      <div className="container-page flex flex-col items-center pt-20 pb-6 text-center sm:pt-28 lg:pt-32 lg:pb-0">
        <Reveal variant="blur">
          <p className="text-sm font-semibold text-pine-400">Como funciona</p>
        </Reveal>
        <Reveal variant="blur" delay={100}>
          <h2 id="pl-ciclo" className="headline mt-3 max-w-[16ch] text-white">
            Da saída à nova entrada.
          </h2>
        </Reveal>
        <Reveal variant="blur" delay={200}>
          <p className="mt-4 flex items-center gap-2 text-lg text-pine-300 sm:text-xl">
            <BellRing aria-hidden className="size-5 shrink-0" strokeWidth={1.75} /> Três momentos, sem telefonemas.
          </p>
        </Reveal>
      </div>
      {reduced ? (
        <div className="pt-14">
          <Empilhado d={d} />
        </div>
      ) : (
        <StickyScene
          length={lado ? '330vh' : '270vh'}
          label="Da saída à nova entrada, em três momentos"
          innerClassName="pb-[var(--tabbar-h)]"
        >
          {(p) => <Cena d={d} p={p} />}
        </StickyScene>
      )}
    </div>
  )
}
