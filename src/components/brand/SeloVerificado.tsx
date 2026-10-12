import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { niveisVerificacao } from '@/lib/negocio'
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

/** Os três níveis de verificação, do mais básico ao mais exigente (docs/MODELO-NEGOCIO.md). */
const NIVEIS = [
  { chave: 'licenca', texto: 'Licença confirmada' },
  { chave: 'visitado', texto: 'Visitada pela equipa' },
  { chave: 'avaliacoesVerificadas', texto: 'Avaliações verificadas' },
] as const

/**
 * Lista compacta dos níveis de verificação de uma instituição: cada nível com um visto (cumprido) ou um círculo
 * vazio (ainda não). O estado não depende só da cor nem do ícone: o leitor de ecrã ouve "Licença confirmada: sim".
 * Por omissão é uma coluna; passe `className="sm:flex-row sm:gap-6"` para a pôr numa linha.
 */
export function SeloNiveis({ lar, className }: { lar: Pick<Lar, 'verificacao' | 'reviews'>; className?: string }) {
  const niveis = niveisVerificacao(lar)
  return (
    <ul aria-label="Níveis de verificação" className={cn('flex flex-col gap-2', className)}>
      {NIVEIS.map(({ chave, texto }) => {
        const ok = niveis[chave]
        return (
          <li key={chave} className="relative flex min-h-7 items-center gap-2.5">
            {ok ? (
              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-terra-600 text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            ) : (
              <span aria-hidden className="size-5 shrink-0 rounded-full border-[1.5px] border-pine-400" />
            )}
            <span className={ok ? 'text-ink' : 'text-ink-mute'}>
              {texto}
              <span className="sr-only">{ok ? ': sim' : ': ainda não'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
