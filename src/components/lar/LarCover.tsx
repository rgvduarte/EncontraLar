import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Ilustração de capa gerada (sem fotografias no protótipo): fachada portuguesa estilizada.
 * variante 0 = casa tradicional · 1 = residência moderna · 2 = solar com arcadas · 3 = casas de azulejo
 */
const PALETAS = [
  { accent: '#2f7f72', sky: ['#d9eee8', '#fbf3e4'], wall2: '#f3e3c3' },
  { accent: '#3d6fb6', sky: ['#d8e6f7', '#fdf4e6'], wall2: '#f6dfd4' },
  { accent: '#b9472f', sky: ['#f8e0d3', '#fdf6ea'], wall2: '#f2e6c4' },
  { accent: '#6f5aa0', sky: ['#e6e0f3', '#fdf5ec'], wall2: '#f5e3cf' },
  { accent: '#b57f12', sky: ['#f7eac6', '#fdf7ea'], wall2: '#e6eedf' },
  { accent: '#2b7894', sky: ['#d4ebf2', '#fcf5e8'], wall2: '#f4dccf' },
  { accent: '#4a8538', sky: ['#e0efd3', '#fdf6e8'], wall2: '#f3e5c8' },
  { accent: '#a3456a', sky: ['#f5dbe4', '#fdf5ec'], wall2: '#efe7cf' },
]

export function LarCover({
  hue,
  variante,
  className,
  title,
}: {
  hue: number
  variante: number
  className?: string
  /** texto alternativo; omitir para ilustração decorativa */
  title?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const p = PALETAS[Math.floor((((hue % 360) + 360) % 360) / 45) % PALETAS.length]!
  const v = ((variante % 4) + 4) % 4
  const sky = `sky${uid}`
  const tile = `tile${uid}`
  const glass = `glass${uid}`
  const roof = '#c4643f'
  const roofDark = '#9f4c2e'
  const wall = '#fbf7ef'
  const line = '#e3d6bf'

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
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4f1f4" />
          <stop offset="1" stopColor="#a9cbd6" />
        </linearGradient>
        <pattern id={tile} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#f3f6fb" />
          <path d="M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z" fill="none" stroke="#3d6fb6" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="1.4" fill="#3d6fb6" />
          <path d="M0 0 h2 a2 2 0 0 1 -2 2Z M12 0 v2 a2 2 0 0 1 -2 -2Z M0 12 v-2 a2 2 0 0 1 2 2Z M12 12 h-2 a2 2 0 0 1 2 -2Z" fill="#3d6fb6" opacity="0.7" />
        </pattern>
      </defs>

      {/* céu, sol e colinas */}
      <rect width="400" height="250" fill={`url(#${sky})`} />
      <circle cx="322" cy="62" r="24" fill="#f6c35a" opacity="0.85" />
      <circle cx="322" cy="62" r="38" fill="#f6c35a" opacity="0.18" />
      <path d="M0 170 C 70 128, 140 150, 210 136 S 340 118, 400 140 L400 250 L0 250 Z" fill="#b9d3b4" opacity="0.75" />
      <path d="M0 196 C 90 176, 170 190, 250 182 S 360 170, 400 180 L400 250 L0 250 Z" fill="#9cc18f" />

      {v === 0 && (
        <g>
          <rect x="112" y="120" width="176" height="92" fill={wall} stroke={line} />
          <rect x="112" y="198" width="176" height="14" fill={p.accent} opacity="0.55" />
          <path d="M100 123 L200 78 L300 123 Z" fill={roof} />
          <path d="M120 114 L280 114 M140 105 L260 105 M160 96 L240 96" stroke={roofDark} strokeWidth="1.5" opacity="0.5" />
          <rect x="246" y="84" width="14" height="24" fill={roofDark} />
          <circle cx="200" cy="106" r="7" fill={`url(#${glass})`} stroke={wall} strokeWidth="2" />
          {[128, 158, 220, 250].map((x) => (
            <g key={x}>
              <rect x={x} y="140" width="22" height="28" fill={`url(#${glass})`} stroke="#fff" strokeWidth="2" />
              <rect x={x - 6} y="140" width="5" height="28" fill={p.accent} />
              <rect x={x + 23} y="140" width="5" height="28" fill={p.accent} />
            </g>
          ))}
          <path d="M188 212 L188 172 A12 12 0 0 1 212 172 L212 212 Z" fill={p.accent} />
          <circle cx="207" cy="193" r="1.6" fill="#fff" />
          <path d="M120 212 q6 -10 12 0 M268 212 q6 -10 12 0" fill="#6fa463" />
        </g>
      )}

      {v === 1 && (
        <g>
          <rect x="92" y="108" width="150" height="104" fill="#f5f0e7" stroke={line} />
          <rect x="88" y="102" width="158" height="8" fill="#3d4947" />
          <rect x="236" y="134" width="84" height="78" fill="#c99a6b" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <rect key={i} x={240 + i * 8} y="134" width="3" height="78" fill="#a87b51" opacity="0.7" />
          ))}
          <rect x="232" y="128" width="92" height="7" fill="#3d4947" />
          {[106, 146, 186].map((x) => (
            <g key={x}>
              <rect x={x} y="120" width="32" height="30" fill={`url(#${glass})`} stroke="#3d4947" strokeWidth="1.5" />
              <rect x={x} y="166" width="32" height="30" fill={`url(#${glass})`} stroke="#3d4947" strokeWidth="1.5" />
            </g>
          ))}
          <rect x="98" y="150" width="138" height="2.5" fill="#3d4947" />
          <rect x="98" y="141" width="138" height="10" fill="#cfe6ec" opacity="0.55" />
          <rect x="262" y="160" width="32" height="52" fill={`url(#${glass})`} stroke="#3d4947" strokeWidth="1.5" />
          <rect x="88" y="208" width="236" height="4" fill={p.accent} opacity="0.8" />
          <rect x="250" y="146" width="56" height="6" rx="3" fill={p.accent} />
        </g>
      )}

      {v === 2 && (
        <g>
          <rect x="78" y="124" width="244" height="88" fill={p.wall2} stroke={line} />
          <path d="M66 127 L106 100 L294 100 L334 127 Z" fill={roof} />
          <path d="M174 100 L200 80 L226 100 Z" fill={p.wall2} stroke={line} />
          <circle cx="200" cy="93" r="4.5" fill={p.accent} />
          {[96, 136, 176, 216, 256, 296].map((x, i) =>
            i === 5 ? null : (
              <rect key={x} x={x + 4} y="134" width="16" height="20" fill={`url(#${glass})`} stroke="#fff" strokeWidth="2.5" />
            ),
          )}
          {[90, 135, 180, 225, 270].map((x) => (
            <path key={x} d={`M${x} 212 L${x} 182 A20 20 0 0 1 ${x + 40} 182 L${x + 40} 212 Z`} fill="#7b5a3c" opacity="0.28" />
          ))}
          <path d="M180 212 L180 182 A20 20 0 0 1 220 182 L220 212 Z" fill={p.accent} opacity="0.85" />
          <rect x="78" y="160" width="244" height="3" fill="#fff" opacity="0.7" />
        </g>
      )}

      {v === 3 && (
        <g>
          <rect x="120" y="72" width="80" height="140" fill={`url(#${tile})`} stroke={line} />
          <rect x="200" y="84" width="80" height="128" fill={p.wall2} stroke={line} />
          <path d="M116 74 L132 58 L188 58 L204 74 Z" fill={roof} />
          <path d="M196 86 L212 70 L268 70 L284 86 Z" fill={roof} />
          {[0, 1, 2].map((r) =>
            [0, 1].map((c) => (
              <g key={`a${r}${c}`}>
                <rect x={134 + c * 36} y={86 + r * 38} width="16" height="26" fill={`url(#${glass})`} stroke="#fff" strokeWidth="2.5" />
                {r > 0 && <path d={`M${130 + c * 36} ${114 + r * 38} h24 M${131 + c * 36} ${114 + r * 38} v-7 M${153 + c * 36} ${114 + r * 38} v-7 M${130 + c * 36} ${107 + r * 38} h24`} stroke="#2e3a38" strokeWidth="1.5" fill="none" />}
                <rect x={214 + c * 36} y={98 + r * 36} width="16" height="24" fill={`url(#${glass})`} stroke="#fff" strokeWidth="2.5" />
              </g>
            )),
          )}
          <path d="M150 212 L150 186 A10 10 0 0 1 170 186 L170 212 Z" fill={p.accent} />
          <rect x="232" y="182" width="20" height="30" fill={p.accent} opacity="0.9" />
          <rect x="200" y="84" width="3" height="128" fill="#fff" opacity="0.6" />
        </g>
      )}

      {/* vegetação */}
      <g>
        <rect x="56" y="168" width="5" height="40" fill="#7a5a3a" />
        <circle cx="58" cy="160" r="22" fill="#5f9a54" />
        <circle cx="44" cy="170" r="15" fill="#6faa61" />
        <circle cx="72" cy="172" r="14" fill="#548c49" />
        <ellipse cx="352" cy="166" rx="11" ry="40" fill="#3f7a4a" />
        <ellipse cx="372" cy="182" rx="8" ry="26" fill="#4d8a55" />
        <rect x="350" y="200" width="4" height="12" fill="#6b4f33" />
      </g>
      <path d="M186 212 L214 212 L250 250 L150 250 Z" fill="#efe2c8" />
      <path d="M0 212 L400 212" stroke="#86b07a" strokeWidth="1" opacity="0.6" />
      {[30, 96, 110, 300, 318, 386].map((x, i) => (
        <circle key={x} cx={x} cy={214 + (i % 2) * 6} r="3" fill={i % 2 ? '#f2b8c6' : '#f7d46b'} />
      ))}
    </svg>
  )
}
