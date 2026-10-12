import { memo, useMemo, useState } from 'react'
import type { Disponibilidade, Lar } from '@/types'
import { ES_PATH, INSETS, PT_AZORES_PATH, PT_MADEIRA_PATH, PT_MAINLAND_PATH, PT_VIEWBOX, projectPT } from '@/data/portugal-shape'
import { disponibilidade } from '@/lib/forecast'
import { cn } from '@/lib/cn'

const DOT: Record<Disponibilidade, string> = { disponivel: '#2f8c4b', breve: '#dc9415', espera: '#6a6489' }

const CIDADES = [
  { nome: 'Braga', lat: 41.55, lng: -8.42, dx: 8, anchor: 'start' },
  { nome: 'Porto', lat: 41.15, lng: -8.61, dx: -9, anchor: 'end' },
  { nome: 'Coimbra', lat: 40.21, lng: -8.43, dx: -9, anchor: 'end' },
  { nome: 'Lisboa', lat: 38.72, lng: -9.14, dx: -9, anchor: 'end' },
  { nome: 'Évora', lat: 38.57, lng: -7.91, dx: 8, anchor: 'start' },
  { nome: 'Faro', lat: 37.02, lng: -7.93, dx: 8, anchor: 'start' },
  { nome: 'Viseu', lat: 40.66, lng: -7.91, dx: 8, anchor: 'start' },
  { nome: 'Bragança', lat: 41.81, lng: -6.76, dx: -8, anchor: 'end' },
] as const

export interface PortugalMapProps {
  lares: Lar[]
  /** realça uma instituição */
  highlightId?: string | null
  onSelect?: (lar: Lar) => void
  /** mostrar nomes de cidades */
  labels?: boolean
  /** tema: claro (fundo creme) ou escuro (secções verde-pinho) */
  theme?: 'light' | 'dark'
  className?: string
  /** pulsar as instituições com vaga */
  pulse?: boolean
  title?: string
}

/** Mapa estilizado de Portugal (continente + ilhas) com um ponto por instituição, colorido pela disponibilidade. */
export const PortugalMap = memo(function PortugalMap({
  lares,
  highlightId,
  onSelect,
  labels = true,
  theme = 'light',
  className,
  pulse = true,
  title = 'Mapa de Portugal com as instituições e a sua disponibilidade',
}: PortugalMapProps) {
  const [hover, setHover] = useState<string | null>(null)
  const pontos = useMemo(
    () =>
      lares
        .map((l) => ({ lar: l, ...projectPT(l.lat, l.lng), d: disponibilidade(l) }))
        // as disponíveis por cima
        .sort((a, b) => (a.d === 'disponivel' ? 1 : 0) - (b.d === 'disponivel' ? 1 : 0)),
    [lares],
  )
  const dark = theme === 'dark'
  const land = dark ? '#204e48' : '#ffffff'
  const landStroke = dark ? '#4f9b8c' : '#80bbac'
  const spain = dark ? '#173a37' : '#efe7da'
  const text = dark ? '#d6ebe5' : '#46524f'
  const ativo = hover ?? highlightId ?? null
  const ativoP = ativo ? pontos.find((p) => p.lar.id === ativo) : undefined

  return (
    <svg
      viewBox={`${PT_VIEWBOX.x} ${PT_VIEWBOX.y} ${PT_VIEWBOX.w} ${PT_VIEWBOX.h}`}
      className={cn('block h-auto w-full overflow-hidden', className)}
      role="img"
      aria-label={title}
    >
      <path d={ES_PATH} fill={spain} />
      <text x="215" y="250" fill={text} opacity="0.55" fontSize="13" letterSpacing="4" fontFamily="'Atkinson Hyperlegible', sans-serif">
        ESPANHA
      </text>
      <path d={PT_MAINLAND_PATH} fill={land} stroke={landStroke} strokeWidth="1.4" strokeLinejoin="round" />
      {Object.values(INSETS).map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill="none" stroke={landStroke} strokeDasharray="3 4" opacity="0.8" />
          <text x={b.x + 8} y={b.y + 16} fill={text} fontSize="11" fontWeight="700" letterSpacing="1.5" fontFamily="'Atkinson Hyperlegible', sans-serif">
            {b.label.toUpperCase()}
          </text>
        </g>
      ))}
      <path d={PT_AZORES_PATH} fill={land} stroke={landStroke} strokeWidth="1" />
      <path d={PT_MADEIRA_PATH} fill={land} stroke={landStroke} strokeWidth="1" />

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
              fontSize="12"
              fontWeight="700"
              fontFamily="'Atkinson Hyperlegible', sans-serif"
              paintOrder="stroke"
              stroke={dark ? '#0b2321' : '#fbf8f3'}
              strokeWidth="3"
              strokeLinejoin="round"
            >
              {c.nome}
            </text>
          )
        })}

      {pontos.map(({ lar, x, y, d }) => {
        const isAtivo = ativo === lar.id
        const Comp = onSelect ? 'a' : 'g'
        return (
          <Comp
            key={lar.id}
            {...(onSelect
              ? {
                  href: `#/lar/${lar.id}`,
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault()
                    onSelect(lar)
                  },
                  onMouseEnter: () => setHover(lar.id),
                  onMouseLeave: () => setHover(null),
                  onFocus: () => setHover(lar.id),
                  onBlur: () => setHover(null),
                  'aria-label': lar.nome,
                }
              : {})}
          >
            {pulse && d === 'disponivel' && (
              <circle cx={x} cy={y} r="4" fill={DOT[d]} opacity="0.5">
                <animate attributeName="r" values="4;12;4" dur="2.6s" begin={`${(x * 7 + y) % 2.6}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;0;0.45" dur="2.6s" begin={`${(x * 7 + y) % 2.6}s`} repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={x}
              cy={y}
              r={isAtivo ? 7 : d === 'disponivel' ? 4.4 : 3.6}
              fill={DOT[d]}
              stroke={dark ? '#0b2321' : '#ffffff'}
              strokeWidth={isAtivo ? 2.5 : 1.4}
              style={{ transition: 'r .15s' }}
            />
          </Comp>
        )
      })}

      {ativoP && (
        <g pointerEvents="none">
          <rect
            x={Math.min(PT_VIEWBOX.x + PT_VIEWBOX.w - 182, Math.max(PT_VIEWBOX.x + 4, ativoP.x - 90))}
            y={ativoP.y - 46}
            width="180"
            height="32"
            rx="10"
            fill={dark ? '#fbf8f3' : '#1c2a29'}
          />
          <text
            x={Math.min(PT_VIEWBOX.x + PT_VIEWBOX.w - 92, Math.max(PT_VIEWBOX.x + 94, ativoP.x))}
            y={ativoP.y - 26}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={dark ? '#1c2a29' : '#fbf8f3'}
            fontFamily="'Atkinson Hyperlegible', sans-serif"
          >
            {ativoP.lar.nome.length > 26 ? `${ativoP.lar.nome.slice(0, 25)}…` : ativoP.lar.nome}
          </text>
        </g>
      )}
    </svg>
  )
})

export function MapLegend({ className, theme = 'light' }: { className?: string; theme?: 'light' | 'dark' }) {
  const items: [Disponibilidade, string][] = [
    ['disponivel', 'Vaga disponível'],
    ['breve', 'Vaga prevista em breve'],
    ['espera', 'Lista de espera'],
  ]
  return (
    <ul className={cn('flex flex-wrap gap-x-5 gap-y-2 text-sm', theme === 'dark' ? 'text-pine-100' : 'text-ink-soft', className)}>
      {items.map(([d, l]) => (
        <li key={d} className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full ring-2 ring-white/70" style={{ background: DOT[d] }} />
          {l}
        </li>
      ))}
    </ul>
  )
}
