import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Lar } from '@/types'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { PT_VIEWBOX, projectPT } from '@/data/portugal-shape'
import { disponibilidade, vagasLivres } from '@/lib/forecast'
import { measureProgress, prefersReducedMotion, subscribeScroll, useInView } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { tempoCurto, ultimasVagas } from './homeData'
import { entrada } from './coreografia'

/** Onde pousa cada etiqueta em ecrãs largos (≥1280px): no mar a oeste e em Espanha a leste, longe dos pontos. */
const POSICAO = [
  'xl:absolute xl:top-[13%] xl:right-[70%]',
  'xl:absolute xl:top-[38%] xl:left-[84%]',
  'xl:absolute xl:top-[66%] xl:left-[86%]',
]

/** Quanto demora a "varrer" o país de norte a sul (a cortina que se levanta). */
const VARRIMENTO = 900

/**
 * Pulsação das instituições com vaga, desenhada por cima do SVG em HTML e animada só com transform/opacity
 * (no compositor). O PortugalMap tem a sua própria pulsação em SMIL (<animate>), mas essa obriga a recalcular
 * e repintar o SVG inteiro (~2000 nós) em cada frame, mesmo parado — por isso aqui usa-se pulse={false}.
 */
function Pulsos({ lares, atraso }: { lares: Lar[]; atraso: number }) {
  const pontos = useMemo(
    () =>
      lares
        .filter((l) => disponibilidade(l) === 'disponivel')
        .map((l) => {
          const { x, y } = projectPT(l.lat, l.lng)
          return { id: l.id, left: ((x - PT_VIEWBOX.x) / PT_VIEWBOX.w) * 100, top: ((y - PT_VIEWBOX.y) / PT_VIEWBOX.h) * 100, fase: (x * 7 + y) % 2.8 }
        }),
    [lares],
  )
  return (
    <div aria-hidden className="hm-in pointer-events-none absolute inset-0" style={entrada(atraso, 'hm-fade', 900)}>
      {pontos.map((p) => (
        <span
          key={p.id}
          className="hm-halo absolute aspect-square w-[1.84%] rounded-full bg-leaf-500/40"
          style={{ left: `${p.left}%`, top: `${p.top}%`, animationDelay: `${p.fase.toFixed(2)}s` }}
        />
      ))}
    </div>
  )
}

/**
 * Paralaxe que escreve o transform diretamente, medida na figura (que não se mexe). Não usa o <Parallax>
 * partilhado de propósito: esse escreve a variável --p, que é herdada — mudá-la a cada frame obrigava a
 * recalcular o estilo dos ~2000 pontos do mapa.
 */
function useProfundidade(el: RefObject<HTMLElement | null>, referencia: RefObject<HTMLElement | null>, velocidade: number) {
  useEffect(() => {
    const node = el.current
    if (!node) return
    if (!velocidade || prefersReducedMotion()) {
      node.style.transform = ''
      return
    }
    const parar = subscribeScroll(() => {
      const ref = referencia.current
      if (!ref) return
      const p = measureProgress(ref, 'through')
      node.style.transform = `translate3d(0, ${((0.5 - p) * 2 * velocidade).toFixed(1)}px, 0)`
    })
    return () => {
      parar()
      node.style.transform = ''
    }
  }, [el, referencia, velocidade])
}

/**
 * O "produto como imagem": o mapa de Portugal em pontos, com as últimas vagas a flutuar à volta.
 * Entrada: o mapa acende-se de norte para sul quando entra no ecrã, as instituições com vaga começam a
 * pulsar e as etiquetas aparecem uma a uma.
 * Desktop largo: paralaxe subtil entre o mapa (mais longe) e as etiquetas (mais perto).
 * Passar o rato (ou o foco) numa etiqueta realça o ponto da instituição no mapa.
 */
export function HeroMap({ lares, agora, comVaga }: { lares: Lar[]; agora: number; comVaga: number }) {
  const navigate = useNavigate()
  const [destaque, setDestaque] = useState<string | null>(null)
  const ultimas = useMemo(() => ultimasVagas(lares, 3), [lares])
  const mapaRef = useRef<HTMLDivElement>(null)
  const [figRef, visto] = useInView<HTMLElement>({ threshold: 0.15, rootMargin: '0px' })
  const [montado] = useState(() => performance.now())
  const [base, setBase] = useState(0)
  const largo = useMediaQuery('(min-width: 1280px)')
  const camadaMapa = useRef<HTMLDivElement>(null)
  const camadaEtiquetas = useRef<HTMLDivElement>(null)
  // profundidade: o mapa fica "mais longe" (desce um pouco), as etiquetas "mais perto" (sobem mais depressa)
  useProfundidade(camadaMapa, figRef, largo ? -18 : 0)
  useProfundidade(camadaEtiquetas, figRef, largo ? 42 : 0)

  // O PortugalMap declara role="img" mas, com onSelect, contém ligações focáveis (um "img" não pode ter
  // controlos lá dentro). Até o componente partilhado tratar disto, expomo-lo como grupo de ligações.
  useEffect(() => {
    mapaRef.current?.querySelector('svg[role="img"]')?.setAttribute('role', 'group')
  }, [])

  // antes da primeira pintura com o mapa visível: se o mapa já está no ecrã ao abrir a página, espera que o
  // título acabe de entrar; se só aparece com o scroll, começa logo
  useLayoutEffect(() => {
    if (visto) setBase(Math.max(0, 950 - (performance.now() - montado)))
  }, [visto, montado])

  return (
    <figure ref={figRef} className="hm-map relative mx-auto w-full max-w-[19rem] sm:max-w-[30rem] lg:max-w-[34rem]">
      <div ref={camadaMapa} className={cn(largo && 'will-change-transform')}>
        <div ref={mapaRef} className={cn('relative overflow-hidden', visto ? 'hm-in' : 'hm-wait')} style={entrada(base, 'hm-settle', 900)}>
          <PortugalMap
            lares={lares}
            pulse={false}
            highlightId={destaque}
            onSelect={(l) => navigate(`/lar/${l.id}`)}
            title={`Mapa de Portugal com ${lares.length} instituições, ${comVaga} com vaga agora. Cada ponto abre a ficha da instituição.`}
          />
          {visto && <Pulsos lares={lares} atraso={base + VARRIMENTO + 150} />}
          {/* "acender" de norte para sul: uma cortina branca com a orla esbatida desce e destapa o mapa.
              Um só elemento animado com transform (compositor) — animar os ~2000 pontos um a um obrigava a
              recalcular o estilo e repintar o SVG inteiro em cada frame. */}
          {visto && <span aria-hidden className="hm-veil" style={{ animationDelay: `${Math.round(base + 60)}ms` }} />}
        </div>
      </div>

      {ultimas.length > 0 && (
        // no ecrã largo as etiquetas flutuam à volta do mapa e andam um pouco mais depressa do que ele (profundidade)
        <div ref={camadaEtiquetas} className="relative z-10 mt-8 xl:pointer-events-none xl:absolute xl:inset-0 xl:mt-0 xl:will-change-transform">
          <ul aria-label="Vagas atualizadas há menos tempo" className="flex flex-col items-center gap-3 xl:block xl:h-full">
            {ultimas.map((l, i) => {
              const n = vagasLivres(l)
              return (
                <li
                  key={l.id}
                  className={cn('xl:pointer-events-auto', POSICAO[i], i === 2 && 'max-xl:hidden', visto ? 'hm-in' : 'hm-wait')}
                  style={entrada(base + VARRIMENTO + 380 + i * 190, 'hm-pop', 900)}
                >
                  <Link
                    to={`/lar/${l.id}`}
                    onMouseEnter={() => setDestaque(l.id)}
                    onMouseLeave={() => setDestaque(null)}
                    onFocus={() => setDestaque(l.id)}
                    onBlur={() => setDestaque(null)}
                    className={cn(
                      'flex min-h-12 items-center gap-2.5 rounded-full bg-white/90 py-2 pr-5 pl-4 text-sm whitespace-nowrap shadow-card ring-1 ring-black/5 backdrop-blur-md',
                      'transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)] hover:-translate-y-0.5',
                    )}
                  >
                    <span aria-hidden className="size-2 shrink-0 animate-pulse-ring rounded-full bg-leaf-500" />
                    <span className="max-w-[10rem] truncate font-medium text-ink sm:max-w-[15rem]">{l.nome}</span>
                    <span className="text-ink-mute">
                      · {n} {n === 1 ? 'vaga' : 'vagas'} · {tempoCurto(l.atualizadoEm, agora)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <figcaption
        className={cn('mt-8 flex justify-center xl:mt-10', visto ? 'hm-in' : 'hm-wait')}
        style={entrada(base + VARRIMENTO + 300, 'hm-fade', 900)}
      >
        <MapLegend className="justify-center" />
      </figcaption>
    </figure>
  )
}
