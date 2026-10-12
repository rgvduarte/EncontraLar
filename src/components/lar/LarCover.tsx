import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Capa abstrata e calma (sem fotografias no protótipo): gradiente suave em tons pastel
 * e a silhueta de uma casa em branco translúcido. A variante muda a silhueta.
 */
const PALETAS: [string, string, string][] = [
  ['#e4ecf6', '#c7d9ef', '#f4f7fb'],
  ['#e5f0e8', '#c9e2d2', '#f3f8f4'],
  ['#f4ece3', '#e7d6c3', '#faf6f1'],
  ['#ece7f4', '#d8cdea', '#f6f3fa'],
  ['#e2eff0', '#c3dfe2', '#f2f8f8'],
  ['#f5e9e8', '#e9cfcd', '#fbf4f3'],
  ['#edefe4', '#d9dfc6', '#f7f8f1'],
  ['#e8eaef', '#d0d5de', '#f4f5f8'],
]

const SILHUETAS = [
  // casa de duas águas
  'M120 250 V150 L200 92 L280 150 V250 Z',
  // residência moderna (dois volumes)
  'M88 250 V128 H214 V250 Z M214 250 V160 H312 V250 Z',
  // casa comprida e baixa
  'M70 250 V170 L120 138 H280 L330 170 V250 Z',
  // casa alta de cidade
  'M150 250 V86 L180 66 H220 L250 86 V250 Z',
]

export function LarCover({ hue, variante, className, title }: { hue: number; variante: number; className?: string; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [a, b, c] = PALETAS[Math.floor((((hue % 360) + 360) % 360) / 45) % PALETAS.length]!
  const v = ((variante % 4) + 4) % 4
  return (
    <svg
      viewBox="0 0 400 250"
      preserveAspectRatio="xMidYMid slice"
      className={cn('block h-full w-full', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
        <radialGradient id={`r${uid}`} cx={v % 2 ? 0.2 : 0.8} cy="0.15" r="0.75">
          <stop offset="0" stopColor={b} stopOpacity="0.95" />
          <stop offset="1" stopColor={b} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`h${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill={`url(#g${uid})`} />
      <rect width="400" height="250" fill={`url(#r${uid})`} />
      <path d={SILHUETAS[v]} fill={`url(#h${uid})`} />
      <rect x="0" y="249" width="400" height="1" fill="#ffffff" opacity="0.6" />
    </svg>
  )
}
