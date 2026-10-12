import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { precoResumo, type DadosLar } from './helpers'

const PONTO = { disponivel: 'bg-leaf-500', breve: 'bg-sun-500', espera: 'bg-dusk-500' } as const

/** Barra fixa no fundo (telemóvel/tablet): preço + ação principal. Some quando o cartão de vagas está à vista. */
export function MobileActionBar({
  lar,
  dados,
  ativa,
  minhaFicha,
  visivel,
  onPedir,
}: {
  lar: Lar
  dados: DadosLar
  ativa?: Candidatura
  minhaFicha: boolean
  visivel: boolean
  onPedir: () => void
}) {
  const preco = precoResumo(lar)
  const { livres, unidade, disp } = dados
  const estado = ativa
    ? ESTADO_CANDIDATURA_LABEL[ativa.estado]
    : livres > 0
      ? `${livres} ${livres === 1 ? `${unidade.um} livre` : `${unidade.varios} livres`}`
      : 'Lista de espera'

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[950] border-t border-black/[0.06] bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden',
        'transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)]',
        visivel ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
      aria-hidden={!visivel}
      inert={!visivel}
    >
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-ink">
            {preco ? (
              <>
                {preco.desde && <span className="text-sm text-ink-mute">desde </span>}
                <span className="text-lg font-semibold tabular">{preco.valor}</span>
                <span className="text-sm text-ink-mute">/mês</span>
              </>
            ) : (
              <span className="font-semibold">Preço sob consulta</span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-soft">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ativa ? 'bg-terra-600' : PONTO[disp])} />
            {estado}
          </p>
        </div>
        {ativa ? (
          <ButtonLink to="/familia/pedidos">Ver pedido</ButtonLink>
        ) : minhaFicha ? (
          <ButtonLink to="/gestao/ficha">Editar ficha</ButtonLink>
        ) : (
          <Button onClick={onPedir}>{livres > 0 ? (dados.centroDia ? 'Pedir lugar' : 'Pedir vaga') : 'Entrar na lista'}</Button>
        )}
      </div>
    </div>
  )
}
