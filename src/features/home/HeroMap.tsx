import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Lar } from '@/types'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { Parallax } from '@/components/motion/Parallax'
import { vagasLivres } from '@/lib/forecast'
import { prefersReducedMotion, useInView } from '@/lib/motion'
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

/** Altura útil do mapa no sistema de coordenadas do SVG (norte = 0, Algarve ≈ 530). */
const ALTURA = 540
/** Quanto demora a "varrer" o país de norte a sul. */
const VARRIMENTO = 1150

/**
 * "Acende" o mapa de norte para sul: cada ponto recebe um atraso proporcional à latitude (com um pouco de
 * acaso para parecer orgânico). Só opacity/transform, e só uma vez. O PortugalMap é partilhado, por isso
 * isto escreve estilos inline nos nós já desenhados em vez de mudar o componente.
 */
function acenderMapa(svg: SVGSVGElement, base: number) {
  const atraso = (y: number, extra = 0) => base + extra + Math.max(0, Math.min(1, y / ALTURA)) * VARRIMENTO
  for (const el of Array.from(svg.children)) {
    if (!(el instanceof SVGElement)) continue
    const tag = el.tagName.toLowerCase()
    if (tag === 'circle') {
      // grelha de pontos cinzentos
      const x = Number(el.getAttribute('cx'))
      const y = Number(el.getAttribute('cy'))
      const acaso = (Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * 43758.5453) % 1
      el.style.animation = `hm-dot 520ms ease-out ${Math.round(atraso(y, acaso * 240))}ms backwards`
    } else if (tag === 'a' || tag === 'g') {
      // instituições: "acendem" um pouco depois da grelha à sua volta
      const c = el.querySelector('circle:last-of-type')
      const y = Number(c?.getAttribute('cy') ?? 0)
      el.style.transformBox = 'fill-box'
      el.style.transformOrigin = 'center'
      el.style.animation = `hm-dot-pop 640ms cubic-bezier(.16,1,.3,1) ${Math.round(atraso(y, 260))}ms backwards`
    } else if (tag === 'path' || tag === 'text') {
      // ilhas e nomes das cidades
      el.style.animation = `hm-dot 700ms ease-out ${Math.round(base + VARRIMENTO * 0.7)}ms backwards`
    }
  }
}

/**
 * O "produto como imagem": o mapa de Portugal em pontos, com as últimas vagas a flutuar à volta.
 * Entrada: o mapa acende-se de norte para sul quando entra no ecrã; depois as etiquetas aparecem uma a uma.
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

  // O PortugalMap declara role="img" mas, com onSelect, contém ligações focáveis (um "img" não pode ter
  // controlos lá dentro). Até o componente partilhado tratar disto, expomo-lo como grupo de ligações.
  useEffect(() => {
    mapaRef.current?.querySelector('svg[role="img"]')?.setAttribute('role', 'group')
  }, [])

  // antes da primeira pintura com o mapa visível: atrasos de cada ponto (se o mapa já está no ecrã ao abrir
  // a página, espera que o título acabe de entrar; se só aparece com o scroll, começa logo)
  useLayoutEffect(() => {
    if (!visto) return
    const b = Math.max(0, 760 - (performance.now() - montado))
    setBase(b)
    const svg = mapaRef.current?.querySelector('svg')
    if (svg && !prefersReducedMotion()) acenderMapa(svg, b + 120)
  }, [visto, montado])

  return (
    <figure ref={figRef} className="hm-map relative mx-auto w-full max-w-[19rem] sm:max-w-[30rem] lg:max-w-[34rem]">
      <Parallax speed={largo ? -18 : 0}>
        <div ref={mapaRef} className={cn(visto ? 'hm-in' : 'hm-wait')} style={entrada(base, 'hm-settle', 900)}>
          <PortugalMap
            lares={lares}
            highlightId={destaque}
            onSelect={(l) => navigate(`/lar/${l.id}`)}
            title={`Mapa de Portugal com ${lares.length} instituições, ${comVaga} com vaga agora. Cada ponto abre a ficha da instituição.`}
          />
        </div>
      </Parallax>

      {ultimas.length > 0 && (
        // no ecrã largo as etiquetas flutuam à volta do mapa e andam um pouco mais depressa do que ele (profundidade)
        <Parallax speed={largo ? 42 : 0} className="relative z-10 mt-8 xl:pointer-events-none xl:absolute xl:inset-0 xl:mt-0">
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
        </Parallax>
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
