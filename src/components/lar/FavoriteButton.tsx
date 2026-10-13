import { Heart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { toggleFavorito, useAcesso, useCurrentUser, useFavorito } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

/** Botão "guardar" (coração). Sem sessão, leva ao login e volta. */
export function FavoriteButton({ larId, larNome, variant = 'overlay', className }: { larId: string; larNome: string; variant?: 'overlay' | 'inline'; className?: string }) {
  const user = useCurrentUser()
  const fav = useFavorito(larId)
  const { completo } = useAcesso()
  const navigate = useNavigate()
  const location = useLocation()
  // os guardados vivem no painel da família: instituições e profissionais não os têm
  if (user && user.role !== 'familia') return null
  const saved = Boolean(fav)

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      // o regresso leva a intenção (?guardar=<id>): depois de entrar, a instituição fica mesmo guardada (Layout)
      const params = new URLSearchParams(location.search)
      params.set('guardar', larId)
      toast.info('Entre para guardar', 'Crie uma conta gratuita para guardar instituições.')
      navigate(`/entrar?voltar=${encodeURIComponent(`${location.pathname}?${params.toString()}`)}`)
      return
    }
    const now = toggleFavorito(larId)
    // os alertas de vaga são do Acesso Família: sem ele, não se promete o aviso
    toast.success(now ? 'Guardado nos seus favoritos' : 'Removido dos favoritos', now ? (completo ? 'Vamos avisá-lo(a) quando houver vaga.' : 'Fica nos guardados do seu painel.') : undefined)
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          'inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-medium transition-colors',
          saved ? 'bg-alert-50 text-alert-700' : 'bg-sand text-ink hover:bg-sand-deep',
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
        'relative z-10 flex size-11 items-center justify-center rounded-full bg-white/85 shadow-soft backdrop-blur-md transition-transform duration-200 hover:scale-105',
        saved ? 'text-alert-600' : 'text-ink hover:text-alert-600',
        className,
      )}
    >
      <Heart aria-hidden className="size-5" fill={saved ? 'currentColor' : 'none'} strokeWidth={2} />
    </button>
  )
}
