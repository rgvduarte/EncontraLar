import { memo, useMemo, useState } from 'react'
import type { Disponibilidade, Lar } from '@/types'
import { INSETS, PT_AZORES_PATH, PT_MADEIRA_PATH, PT_MAINLAND_PATH, PT_VIEWBOX, projectPT } from '@/data/portugal-shape'
import { disponibilidade } from '@/lib/forecast'
import { cn } from '@/lib/cn'

const DOT: Record<Disponibilidade, string> = { disponivel: '#34c759', breve: '#ff9500', espera: '#8e8e93' }

// ——— grelha de pontos (halftone) dentro do contorno do continente, calculada uma vez
function parseRings(path: string): [number, number][][] {
  return path
    .split('M')
    .filter(Boolean)
    .map((ring) =>
      ring
        .replace(/Z/g, '')
        .split('L')
        .map((p) => p.trim().split(/\s+/).map(Number) as [number, number]),
    )
}

function inside(x: number, y: number, rings: [number, number][][]): boolean {
  let dentro = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i]!
      const [xj, yj] = r[j]!
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
    }
  }
  return dentro
}

let GRELHA: { x: number; y: number }[] | null = null
function grelha() {
  if (GRELHA) return GRELHA
  const rings = parseRings(PT_MAINLAND_PATH)
  const pts: { x: number; y: number }[] = []
  const passo = 6.4
  for (let y = 4; y < 540; y += passo) {
    const desloc = (Math.round(y / passo) % 2) * (passo / 2)
    for (let x = -4 + desloc; x < 300; x += passo) if (inside(x, y, rings)) pts.push({ x, y })
  }
  GRELHA = pts
  return pts
}

const CIDADES = [
  { nome: 'Porto', lat: 41.15, lng: -8.61, dx: -10, anchor: 'end' },
  { nome: 'Coimbra', lat: 40.21, lng: -8.43, dx: -10, anchor: 'end' },
  // sobre o mar, a oeste do aglomerado de Lisboa/Sintra/Cascais (não tapa os pontos)
  { nome: 'Lisboa', lat: 38.72, lng: -9.14, dx: -22, anchor: 'end' },
  { nome: 'Évora', lat: 38.57, lng: -7.91, dx: 10, anchor: 'start' },
  { nome: 'Faro', lat: 37.02, lng: -7.93, dx: 10, anchor: 'start' },
  { nome: 'Braga', lat: 41.55, lng: -8.42, dx: 10, anchor: 'start' },
] as const

export interface PortugalMapProps {
  lares: Lar[]
  /** realça uma instituição */
  highlightId?: string | null
  onSelect?: (lar: Lar) => void
  /** mostrar nomes de cidades */
  labels?: boolean
  theme?: 'light' | 'dark'
  className?: string
  /** pulsar as instituições com vaga (por omissão desligado — custa repintura em mapas grandes) */
  pulse?: boolean
  title?: string
}

/** Mapa de Portugal em pontos (estilo halftone), com um ponto de cor por instituição. */
export const PortugalMap = memo(function PortugalMap({
  lares,
  highlightId,
  onSelect,
  labels = true,
  theme = 'light',
  className,
  pulse = false,
  title = 'Mapa de Portugal com as instituições e a sua disponibilidade',
}: PortugalMapProps) {
  const [hover, setHover] = useState<string | null>(null)
  const pontos = useMemo(
    () =>
      lares
        .map((l) => ({ lar: l, ...projectPT(l.lat, l.lng), d: disponibilidade(l) }))
        .sort((a, b) => (a.d === 'disponivel' ? 1 : 0) - (b.d === 'disponivel' ? 1 : 0)),
    [lares],
  )
  const base = useMemo(grelha, [])
  const dark = theme === 'dark'
  const dotBase = dark ? '#3a3a3c' : '#d9d9de'
  const text = dark ? '#a1a1a6' : '#86868b'
  const ativo = hover ?? highlightId ?? null
  const ativoP = ativo ? pontos.find((p) => p.lar.id === ativo) : undefined

  return (
    <svg
      viewBox={`${PT_VIEWBOX.x} ${PT_VIEWBOX.y} ${PT_VIEWBOX.w} ${PT_VIEWBOX.h}`}
      className={cn('block h-auto w-full', className)}
      // sempre uma imagem com nome: os pontos clicáveis (onSelect) são só um atalho para rato — pontos de 4–6px
      // não são alvos de toque nem de teclado; as fichas abrem-se pelas listas e pela pesquisa
      role="img"
      aria-label={title}
    >
      {base.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.75" fill={dotBase} />
      ))}
      <path d={PT_AZORES_PATH} fill={dotBase} />
      <path d={PT_MADEIRA_PATH} fill={dotBase} />
      {Object.values(INSETS).map((b) => (
        <text key={b.label} x={b.x + 6} y={b.y + 12} fill={text} fontSize="11" fontWeight="500" fontFamily="'Inter Variable', sans-serif">
          {b.label}
        </text>
      ))}

      {pontos.map(({ lar, x, y, d }) => {
        const isAtivo = ativo === lar.id
        return (
          // com onSelect, o ponto é só um atalho para rato: um <g> com clique (não uma ligação) — dentro de um role="img"
          // não pode haver nada interativo (axe nested-interactive); o leitor de ecrã e o teclado usam as listas
          <g
            key={lar.id}
            {...(onSelect
              ? {
                  onClick: () => onSelect(lar),
                  onMouseEnter: () => setHover(lar.id),
                  onMouseLeave: () => setHover(null),
                  className: 'cursor-pointer',
                  'aria-hidden': true,
                }
              : {})}
          >
            {pulse && d === 'disponivel' && (
              // halo leve: animação CSS só de transform/opacity (desligada com movimento reduzido)
              <circle cx={x} cy={y} r="4" fill={DOT[d]} className="pt-pulse" style={{ animationDelay: `${((x * 7 + y) % 2.8).toFixed(2)}s` }} />
            )}
            <circle
              cx={x}
              cy={y}
              r={isAtivo ? 6.5 : d === 'disponivel' ? 4 : 3.2}
              fill={DOT[d]}
              fillOpacity={d === 'espera' && !isAtivo ? 0.75 : 1}
              stroke={dark ? '#000' : '#fff'}
              strokeWidth={isAtivo ? 2 : 1.2}
            />
          </g>
        )
      })}

      {/* nomes das cidades por cima dos pontos, com contorno da cor do fundo (legíveis sobre o aglomerado) */}
      {labels &&
        CIDADES.map((c) => {
          const p = projectPT(c.lat, c.lng)
          return (
            <text
              key={c.nome}
              x={p.x + c.dx}
              y={p.y + 4}
              textAnchor={c.anchor}
              fill={text}
              fontSize="11.5"
              fontWeight="500"
              fontFamily="'Inter Variable', sans-serif"
              pointerEvents="none"
              paintOrder="stroke"
              stroke={dark ? '#000' : '#fff'}
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {c.nome}
            </text>
          )
        })}

      {ativoP && (
        <g pointerEvents="none">
          <rect
            x={Math.min(PT_VIEWBOX.x + PT_VIEWBOX.w - 184, Math.max(PT_VIEWBOX.x + 4, ativoP.x - 90))}
            y={ativoP.y - 44}
            width="180"
            height="30"
            rx="15"
            fill={dark ? '#f5f5f7' : '#1d1d1f'}
          />
          <text
            x={Math.min(PT_VIEWBOX.x + PT_VIEWBOX.w - 94, Math.max(PT_VIEWBOX.x + 94, ativoP.x))}
            y={ativoP.y - 25}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="600"
            fill={dark ? '#1d1d1f' : '#ffffff'}
            fontFamily="'Inter Variable', sans-serif"
          >
            {ativoP.lar.nome.length > 27 ? `${ativoP.lar.nome.slice(0, 26)}…` : ativoP.lar.nome}
          </text>
        </g>
      )}
    </svg>
  )
})

export function MapLegend({ className, theme = 'light' }: { className?: string; theme?: 'light' | 'dark' }) {
  const items: [Disponibilidade, string][] = [
    ['disponivel', 'Vaga disponível'],
    ['breve', 'Vaga em breve'],
    ['espera', 'Lista de espera'],
  ]
  return (
    <ul className={cn('flex flex-wrap gap-x-5 gap-y-2 text-sm', theme === 'dark' ? 'text-pine-300' : 'text-ink-mute', className)}>
      {items.map(([d, l]) => (
        <li key={d} className="inline-flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: DOT[d] }} />
          {l}
        </li>
      ))}
    </ul>
  )
}
