import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Classificação em estrelas (só leitura). */
export function Stars({ value, size = 'sm', className }: { value: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const px = size === 'sm' ? 'size-4' : size === 'md' ? 'size-5' : 'size-6'
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value.toLocaleString('pt-PT')} em 5 estrelas`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className={cn('relative inline-block', px)}>
            <Star aria-hidden className={cn('absolute inset-0 text-sun-200', px)} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star aria-hidden className={cn('text-sun-500', px)} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </span>
  )
}
