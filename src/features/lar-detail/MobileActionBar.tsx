import { ArrowRight, Send } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { euro } from '@/lib/format'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { precoDesde, type DadosLar } from './helpers'

/** Barra fixa no fundo (telemóvel/tablet): preço + ação principal. Some quando o cartão de vagas está visível. */
export function MobileActionBar({
  lar,
  dados,
  ativa,
  visivel,
  onPedir,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  visivel: boolean
  onPedir: () => void
}) {
  const desde = precoDesde(lar)
  const { livres, unidade } = dados
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[950] border-t border-line bg-white/97 shadow-[0_-10px_30px_-12px_rgb(70_50_20/0.28)] backdrop-blur transition-transform duration-300 lg:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        visivel ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
      aria-hidden={!visivel}
      inert={!visivel}
    >
      <div className="container-page flex items-center justify-between gap-3 py-3">
        <div className="min-w-0 leading-tight">
          {desde != null ? (
            <p className="truncate">
              <span className="text-sm text-ink-soft">desde </span>
              <span className="font-display text-xl font-semibold text-ink tabular">{euro(desde)}</span>
              <span className="text-sm text-ink-soft">/mês</span>
            </p>
          ) : (
            <p className="font-semibold">Preço sob consulta</p>
          )}
          <p className={cn('flex items-center gap-1.5 truncate text-sm font-semibold', livres > 0 ? 'text-leaf-700' : 'text-dusk-700')}>
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', livres > 0 ? 'bg-leaf-500' : 'bg-dusk-500')} />
            {ativa
              ? ESTADO_CANDIDATURA_LABEL[ativa.estado]
              : livres > 0
                ? `${livres} ${livres === 1 ? `${unidade.um} livre` : `${unidade.varios} livres`}`
                : 'Lista de espera'}
          </p>
        </div>
        {ativa ? (
          <ButtonLink to="/familia/pedidos" iconRight={<ArrowRight aria-hidden className="size-5" />}>
            Ver pedido
          </ButtonLink>
        ) : (
          <Button onClick={onPedir} icon={<Send aria-hidden className="size-5" />}>
            {livres > 0 ? 'Pedir vaga' : 'Inscrever-me'}
          </Button>
        )}
      </div>
    </div>
  )
}
