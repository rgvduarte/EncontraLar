import { memo, useMemo } from 'react'
import type { Disponibilidade } from '@/types'
import { cn } from '@/lib/cn'
import type { Local } from '../model'
import type { PontoRadar } from '../area'

const COR: Record<Disponibilidade, string> = { disponivel: '#2f8c4b', breve: '#dc9415', espera: '#6a6489' }
const TXT: Record<Disponibilidade, string> = { disponivel: '#ffffff', breve: '#1c2a29', espera: '#ffffff' }

const S = 400
const C = S / 2
const R = 176

const kmTxt = (v: number) => `${v.toLocaleString('pt-PT', { maximumFractionDigits: v < 10 ? 1 : 0 })} km`

/**
 * "Mapa de proximidade": a casa da família ao centro, anéis de distância e um ponto por instituição
 * (cor + número). Funciona sem mosaicos de mapa e lê-se num relance: quem está perto, quem tem vaga.
 * É complementar — a lista ao lado é a fonte acessível.
 */
export const ProximityRadar = memo(function ProximityRadar({
  centro,
  raioKm,
  pontos,
  extentKm,
  destaque,
  onPonto,
  rotuloCentro,
  titulo,
  className,
}: {
  centro: Local
  raioKm: number
  pontos: PontoRadar[]
  /** distância representada no anel exterior (por defeito 1,3 × raio) */
  extentKm?: number
  destaque?: string | null
  onPonto?: (id: string) => void
  rotuloCentro: string
  titulo: string
  className?: string
}) {
  const ext = Math.max(raioKm * 1.05, extentKm ?? raioKm * 1.3)
  const k = R / ext
  const cosLat = Math.cos((centro.lat * Math.PI) / 180)

  const proj = useMemo(
    () =>
      pontos
        .map((p) => {
          const dx = (p.lng - centro.lng) * 111.32 * cosLat
          const dy = (p.lat - centro.lat) * 110.57
          const d = Math.hypot(dx, dy)
          return { ...p, x: C + dx * k, y: C - dy * k, d }
        })
        .filter((p) => p.d <= ext)
        // números mais baixos (melhores) desenhados por cima
        .sort((a, b) => (b.rank ?? 999) - (a.rank ?? 999) || Number(a.disp === 'disponivel') - Number(b.disp === 'disponivel')),
    [pontos, centro.lat, centro.lng, cosLat, k, ext],
  )

  const rRaio = raioKm * k
  const metade = raioKm / 2

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className={cn('block h-auto w-full', className)} role="img" aria-label={titulo}>
      <defs>
        <radialGradient id="radar-fundo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#eef6f4" />
          <stop offset="1" stopColor="#fbf8f3" />
        </radialGradient>
      </defs>
      {/* anel exterior (fora do raio) */}
      <circle cx={C} cy={C} r={R + 10} fill="#f4ede2" />
      <circle cx={C} cy={C} r={R + 10} fill="none" stroke="#cbbda7" strokeDasharray="2 5" />
      {/* zona do raio */}
      <circle cx={C} cy={C} r={rRaio} fill="url(#radar-fundo)" stroke="#2f7f72" strokeWidth="2" />
      <circle cx={C} cy={C} r={rRaio / 2} fill="none" stroke="#80bbac" strokeDasharray="4 5" />
      {/* eixos */}
      <g stroke="#cbbda7" strokeWidth="1" opacity="0.7">
        <line x1={C} y1={C - R - 10} x2={C} y2={C + R + 10} />
        <line x1={C - R - 10} y1={C} x2={C + R + 10} y2={C} />
      </g>
      <text x={C} y={C - R - 16} textAnchor="middle" fontSize="13" fontWeight="700" fill="#46524f" fontFamily="'Fraunces Variable', Georgia, serif">
        N
      </text>

      {/* etiquetas dos anéis */}
      <g fontFamily="'Atkinson Hyperlegible', sans-serif" fontWeight="700" fontSize="12">
        <rect x={C + 6} y={C - rRaio - 11} width={kmTxt(raioKm).length * 7 + 12} height="22" rx="11" fill="#1d564e" />
        <text x={C + 12} y={C - rRaio + 4} fill="#ffffff">
          {kmTxt(raioKm)}
        </text>
        {rRaio / 2 > 34 && (
          <text x={C + 6} y={C - rRaio / 2 - 5} fill="#22695e">
            {kmTxt(metade)}
          </text>
        )}
      </g>

      {/* instituições */}
      {proj.map((p) => {
        const ativo = destaque === p.id
        const numerado = p.rank != null
        const raio = numerado ? (ativo ? 15 : 12) : ativo ? 7 : 4.6
        return (
          <g
            key={p.id}
            opacity={p.esbatido ? 0.35 : 1}
            onClick={onPonto ? () => onPonto(p.id) : undefined}
            style={onPonto ? { cursor: 'pointer' } : undefined}
          >
            {ativo && <circle cx={p.x} cy={p.y} r={raio + 6} fill={COR[p.disp]} opacity="0.22" />}
            <circle cx={p.x} cy={p.y} r={raio} fill={COR[p.disp]} stroke="#ffffff" strokeWidth={numerado ? 2.5 : 1.5} />
            {numerado && (
              <text
                x={p.x}
                y={p.y + 4.5}
                textAnchor="middle"
                fontSize={ativo ? 15 : 13}
                fontWeight="700"
                fill={TXT[p.disp]}
                fontFamily="'Atkinson Hyperlegible', sans-serif"
              >
                {p.rank}
              </text>
            )}
          </g>
        )
      })}

      {/* casa da família */}
      <g>
        <circle cx={C} cy={C} r="17" fill="#b9472f" stroke="#ffffff" strokeWidth="3" />
        <path
          d={`M${C - 7} ${C + 1} L${C} ${C - 6} L${C + 7} ${C + 1} M${C - 5} ${C - 1} V${C + 7} H${C + 5} V${C - 1}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x={C}
          y={C + 36}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#1c2a29"
          fontFamily="'Atkinson Hyperlegible', sans-serif"
          paintOrder="stroke"
          stroke="#fbf8f3"
          strokeWidth="4"
          strokeLinejoin="round"
        >
          {rotuloCentro.length > 28 ? `${rotuloCentro.slice(0, 27)}…` : rotuloCentro}
        </text>
      </g>
    </svg>
  )
})

/** Legenda do mapa de proximidade (cor + texto, nunca só cor). */
export function RadarLegend({ className, numerado }: { className?: string; numerado?: boolean }) {
  const itens: [Disponibilidade, string][] = [
    ['disponivel', 'Vaga agora'],
    ['breve', 'Vaga prevista em breve'],
    ['espera', 'Lista de espera'],
  ]
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft', className)}>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="size-3.5 rounded-full border-2 border-white bg-terra-600 ring-1 ring-terra-600" />
        Ponto de partida
      </li>
      {itens.map(([d, l]) => (
        <li key={d} className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3.5 rounded-full ring-2 ring-white" style={{ background: COR[d] }} />
          {l}
        </li>
      ))}
      {numerado && <li className="text-ink-mute">Números = posição na lista</li>}
    </ul>
  )
}
