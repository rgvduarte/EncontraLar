import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, ChevronRight, Info } from 'lucide-react'
import type { Lar, Review } from '@/types'
import { Stars } from '@/components/ui/Stars'
import { Button } from '@/components/ui/Button'
import { AvisoAcesso } from '@/components/acesso'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Bloco, Secao } from '../Secao'
import { Cascata, Contador } from '../motion'
import { caminhoFicha } from '../helpers'

const ASPETOS: { k: keyof Review['aspetos']; label: string }[] = [
  { k: 'cuidados', label: 'Cuidados' },
  { k: 'alimentacao', label: 'Alimentação' },
  { k: 'instalacoes', label: 'Instalações' },
  { k: 'comunicacao', label: 'Comunicação' },
]

const mesExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
const dec1 = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Porque é que uma avaliação é "verificada" (modelo de negócio: só quem confirmou a entrada pode deixá-la). */
const VERIFICADA_EXPLICACAO = 'De uma família cuja entrada foi confirmada.'

/**
 * "Avaliação verificada" com a explicação numa dica: aparece com o ponteiro por cima, com o foco do teclado ou com
 * um toque; fecha com Esc, ao sair ou ao tocar fora. A explicação é também a descrição acessível do botão.
 */
function SeloAvaliacao() {
  const [aberta, setAberta] = useState(false)
  const tipId = useId()
  const raiz = useRef<HTMLSpanElement>(null)

  // toque fora (no telemóvel o botão nem sempre perde o foco)
  useEffect(() => {
    if (!aberta) return
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberta(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberta])

  return (
    // no telemóvel a dica ancora na linha da avaliação (estrelas), para caber no ecrã; no desktop, no próprio selo
    <span ref={raiz} className="inline-flex sm:relative" onMouseEnter={() => setAberta(true)} onMouseLeave={() => setAberta(false)}>
      <button
        type="button"
        aria-describedby={tipId}
        onClick={() => setAberta(true)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && aberta) {
            e.stopPropagation()
            setAberta(false)
          }
        }}
        className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-full text-sm font-medium text-terra-700 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500"
      >
        <BadgeCheck aria-hidden className="size-4" />
        Avaliação verificada
        <Info aria-hidden className="ml-0.5 size-3.5 text-ink-mute" />
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          'absolute bottom-full left-0 z-10 mb-1 w-max max-w-[min(17rem,calc(100vw-2.5rem))] rounded-xl bg-ink px-3.5 py-2.5 text-sm leading-snug text-white shadow-lift',
          'transition-[opacity,visibility,translate] duration-200 ease-[cubic-bezier(.25,.1,.25,1)] motion-reduce:transition-none',
          aberta ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0',
        )}
      >
        {VERIFICADA_EXPLICACAO}
      </span>
    </span>
  )
}

/** Excerto de uma opinião longa: corta numa palavra, perto dos `max` carateres. */
function excerto(texto: string, max = 240): string {
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max)
  const espaco = corte.lastIndexOf(' ')
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.–—-]+$/, '')}…`
}

function Opiniao({ r, nova, curta }: { r: Review; nova?: boolean; curta?: boolean }) {
  return (
    <li className={cn('border-b border-line py-7', nova && 'ficha-troca')}>
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.nota} />
        {r.verificada && <SeloAvaliacao />}
      </div>
      <blockquote className="mt-3 max-w-[65ch] text-lg leading-relaxed text-ink">
        <p>{curta ? excerto(r.texto) : r.texto}</p>
      </blockquote>
      <p className="mt-3 text-sm text-ink-mute">
        <span className="font-medium text-ink-soft">{r.autor}</span> · {r.relacao} · {mesExtenso(r.data)}
      </p>
    </li>
  )
}

/**
 * O que dizem as famílias. Versão grátis (`completo` falso): a média, o número de avaliações e um só excerto
 * (de preferência de uma avaliação verificada); as restantes, as médias por aspeto e o filtro são do Acesso Família.
 */
export function AvaliacoesSection({ lar, completo }: { lar: Lar; completo: boolean }) {
  if (!completo && (lar.numAvaliacoes > 0 || lar.reviews.length > 0)) return <AvaliacoesGratis lar={lar} />
  return <AvaliacoesCompletas lar={lar} />
}

function AvaliacoesGratis({ lar }: { lar: Lar }) {
  const destaque = lar.reviews.find((r) => r.verificada) ?? lar.reviews[0]
  return (
    <Secao id="ficha-avaliacoes" rotulo="Avaliações" titulo="O que dizem as famílias">
      <Bloco>
        <p className="text-7xl leading-none font-semibold tracking-tight text-ink tabular">
          <Contador valor={lar.avaliacao} casas={1} />
        </p>
        <Stars value={lar.avaliacao} size="md" className="mt-4" />
        <p className="mt-2 text-sm text-ink-mute">{plural(lar.numAvaliacoes, 'avaliação', 'avaliações')}</p>
      </Bloco>
      {destaque && (
        <Cascata passo={110} className="mt-12 border-t border-line">
          <Opiniao r={destaque} curta />
        </Cascata>
      )}
      <Bloco>
        <AvisoAcesso texto="Ler todas as avaliações" voltar={caminhoFicha(lar)} className="mt-4" />
      </Bloco>
    </Secao>
  )
}

function AvaliacoesCompletas({ lar }: { lar: Lar }) {
  const [todas, setTodas] = useState(false)
  const [soVerificadas, setSoVerificadas] = useState(false)
  const reviews = lar.reviews
  const nVerificadas = reviews.filter((r) => r.verificada).length
  // o filtro só aparece quando muda alguma coisa (há verificadas e não verificadas)
  const comFiltro = nVerificadas > 0 && nVerificadas < reviews.length
  const lista = comFiltro && soVerificadas ? reviews.filter((r) => r.verificada) : reviews
  const mostradas = todas ? lista : lista.slice(0, 3)
  const medias = ASPETOS.map((a) => ({
    ...a,
    v: reviews.length ? reviews.reduce((s, r) => s + r.aspetos[a.k], 0) / reviews.length : 0,
  }))

  if (lar.numAvaliacoes === 0 && reviews.length === 0) {
    return (
      <Secao id="ficha-avaliacoes" rotulo="Avaliações" titulo="Ainda sem avaliações">
        <Bloco>
          <p className="max-w-[65ch] text-lg text-ink-mute">
            Só famílias com um pedido ou um familiar nesta instituição a podem avaliar. Até lá, a melhor forma de a conhecer é uma visita.
          </p>
          <Link to="/guia#visita" className="mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
            O que perguntar na visita
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </Bloco>
      </Secao>
    )
  }

  return (
    <Secao id="ficha-avaliacoes" rotulo="Avaliações" titulo="O que dizem as famílias">
      <div className="grid gap-10 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-16">
        <Bloco>
          <p className="text-7xl leading-none font-semibold tracking-tight text-ink tabular">
            <Contador valor={lar.avaliacao} casas={1} />
          </p>
          <Stars value={lar.avaliacao} size="md" className="mt-4" />
          <p className="mt-2 text-sm text-ink-mute">{plural(lar.numAvaliacoes, 'avaliação', 'avaliações')}</p>
        </Bloco>
        {reviews.length > 0 && (
          <div>
            {/* médias por aspeto: as barras enchem em cascata quando entram no ecrã */}
            <Cascata as="dl" passo={90} className="flex flex-col gap-4">
              {medias.map((a) => (
                <div key={a.k} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-4">
                  <dt className="text-ink-soft">{a.label}</dt>
                  <dd aria-hidden className="h-1 overflow-hidden rounded-full bg-sand-deep">
                    <div className="ficha-encher h-full rounded-full bg-ink" style={{ width: `${(a.v / 5) * 100}%` }} />
                  </dd>
                  <dd className="text-right font-medium text-ink tabular">
                    {dec1(a.v)}
                    <span className="sr-only"> em 5</span>
                  </dd>
                </div>
              ))}
            </Cascata>
            <p className="mt-4 text-sm text-ink-mute">Por aspeto, nas {plural(reviews.length, 'opinião publicada', 'opiniões publicadas')}.</p>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <>
          {comFiltro && (
            <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm text-ink-mute" aria-live="polite">
                {soVerificadas
                  ? `${plural(nVerificadas, 'avaliação verificada', 'avaliações verificadas')}, de famílias cuja entrada foi confirmada`
                  : `${plural(reviews.length, 'opinião', 'opiniões')}, ${nVerificadas} ${nVerificadas === 1 ? 'verificada' : 'verificadas'}`}
              </p>
              <button
                type="button"
                aria-pressed={soVerificadas}
                onClick={() => {
                  setSoVerificadas((v) => !v)
                  setTodas(false)
                }}
                className={cn(
                  'inline-flex min-h-12 items-center gap-2 rounded-full px-4.5 text-sm font-medium transition-[background-color,color,scale] duration-200 select-none active:scale-[0.96]',
                  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
                  soVerificadas ? 'bg-ink text-white hover:bg-pine-600' : 'bg-sand text-ink hover:bg-sand-deep',
                )}
              >
                <BadgeCheck aria-hidden className="size-4.5" />
                Só verificadas
              </button>
            </div>
          )}
          <Cascata key={soVerificadas ? 'verificadas' : 'todas'} passo={110} className={cn('border-t border-line', comFiltro ? 'mt-4' : 'mt-12')}>
            {mostradas.map((r, i) => (
              <Opiniao key={r.id} r={r} nova={i >= 3} />
            ))}
          </Cascata>
          {lista.length > 3 && (
            <Button variant="subtle" className="mt-8 max-sm:w-full" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
              {todas ? 'Mostrar menos' : soVerificadas ? `Ver as ${lista.length} verificadas` : `Ver as ${lista.length} opiniões`}
            </Button>
          )}
        </>
      )}
    </Secao>
  )
}
