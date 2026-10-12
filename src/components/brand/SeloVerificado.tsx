import { cn } from '@/lib/cn'

/** Selo de verificação minimalista (roseta com visto). */
export function SeloVerificado({ ano, size = 64, className, tone = 'pine' }: { ano?: number; size?: number; className?: string; tone?: 'pine' | 'light' }) {
  const fill = tone === 'light' ? '#ffffff' : '#0071e3'
  const check = tone === 'light' ? '#0071e3' : '#ffffff'
  // roseta de 12 pontas suaves
  const pts = Array.from({ length: 24 }, (_, i) => {
    const r = i % 2 ? 44 : 50
    const a = (Math.PI * 2 * i) / 24 - Math.PI / 2
    return `${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Instituição verificada pelo EncontraLar${ano ? ` em ${ano}` : ''}`} className={cn('shrink-0', className)}>
      <polygon points={pts} fill={fill} strokeLinejoin="round" stroke={fill} strokeWidth="6" />
      <path d="M41 61 l13 13 l26 -28" fill="none" stroke={check} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
