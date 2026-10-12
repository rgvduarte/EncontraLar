import { Heart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { toggleFavorito, useCurrentUser, useFavorito } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

/** Botão "guardar" (coração). Sem sessão, leva ao login e volta. */
export function FavoriteButton({ larId, larNome, variant = 'overlay', className }: { larId: string; larNome: string; variant?: 'overlay' | 'inline'; className?: string }) {
  const user = useCurrentUser()
  const fav = useFavorito(larId)
  const navigate = useNavigate()
  const location = useLocation()
  if (user?.role === 'lar') return null
  const saved = Boolean(fav)

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      toast.info('Entre para guardar', 'Crie uma conta gratuita para guardar instituições e receber alertas de vaga.')
      navigate(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    const now = toggleFavorito(larId)
    toast.success(now ? 'Guardado nos seus favoritos' : 'Removido dos favoritos', now ? 'Vamos avisá-lo(a) quando houver vaga.' : undefined)
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          'inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 px-5 font-bold transition-colors',
          saved ? 'border-terra-300 bg-terra-50 text-terra-700' : 'border-line-strong bg-white text-ink hover:border-terra-400 hover:text-terra-700',
          className,
        )}
      >
        <Heart aria-hidden className="size-5" fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Guardado' : 'Guardar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remover ${larNome} dos favoritos` : `Guardar ${larNome} nos favoritos`}
      className={cn(
        'relative z-10 flex size-12 items-center justify-center rounded-full bg-white/95 shadow-soft backdrop-blur transition-transform hover:scale-105',
        saved ? 'text-terra-600' : 'text-ink-soft hover:text-terra-600',
        className,
      )}
    >
      <Heart aria-hidden className="size-6" fill={saved ? 'currentColor' : 'none'} strokeWidth={2.2} />
    </button>
  )
}
