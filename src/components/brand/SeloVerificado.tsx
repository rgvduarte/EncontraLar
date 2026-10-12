import { useId } from 'react'
import { cn } from '@/lib/cn'

/** Selo circular de verificação, estilo carimbo. */
export function SeloVerificado({ ano, size = 112, className, tone = 'pine' }: { ano?: number; size?: number; className?: string; tone?: 'pine' | 'light' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const c = tone === 'pine' ? '#1d564e' : '#ffffff'
  const txt = `VERIFICADO · ENCONTRALAR · ${ano ?? new Date().getFullYear()} · `
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={`Instituição verificada pelo EncontraLar${ano ? ` em ${ano}` : ''}`}
      className={cn('shrink-0 -rotate-12', className)}
    >
      <defs>
        <path id={`c${id}`} d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={c} strokeWidth="2.5" />
      <circle cx="60" cy="60" r="51" fill="none" stroke={c} strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="60" cy="60" r="32" fill={c} fillOpacity={tone === 'pine' ? 0.08 : 0.15} stroke={c} strokeWidth="1.5" />
      <text fill={c} fontSize="10" fontWeight="700" fontFamily="'Atkinson Hyperlegible', sans-serif">
        <textPath href={`#c${id}`} startOffset="0" textLength="266" lengthAdjust="spacing">
          {txt}
        </textPath>
      </text>
      <path d="M46 61 l9 9 l19 -21" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
