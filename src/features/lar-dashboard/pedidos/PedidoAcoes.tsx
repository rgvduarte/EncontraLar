import { useState } from 'react'
import { Link } from 'react-router'
import { Info, KeyRound } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button, type ButtonVariant } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { acoesDoPedido, type Acao } from './acoes'
import { EstadoModal } from './EstadoModal'

/** Botões de ação de um pedido + diálogo de confirmação com nota para a família. */
export function PedidoAcoes({
  c,
  lar,
  className,
  apenasPrincipal,
  variantePrincipal,
}: {
  c: Candidatura
  lar: Lar
  className?: string
  /** mostra só a primeira ação (as restantes ficam no detalhe do pedido) */
  apenasPrincipal?: boolean
  variantePrincipal?: ButtonVariant
}) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const todas = acoesDoPedido(c, lar)
  const acoes = apenasPrincipal ? todas.slice(0, 1) : todas

  if (c.estado === 'aceite') {
    return (
      <p className={cn('inline-flex min-h-12 items-center gap-2 font-bold text-leaf-700', className)}>
        <KeyRound aria-hidden className="size-5" /> Entrada confirmada
      </p>
    )
  }
  if (!acoes.length) return null
  const bloqueada = acoes.find((a) => a.bloqueio)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {acoes.map((a, i) => (
          <Button
            key={a.id}
            variant={i === 0 && variantePrincipal ? variantePrincipal : a.variant}
            disabled={Boolean(a.bloqueio)}
            icon={<a.icon aria-hidden className="size-5" />}
            onClick={() => setAcao(a)}
            className={a.variant === 'danger' ? 'border-transparent bg-transparent' : undefined}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {bloqueada && (
        <p className="flex max-w-xl items-start gap-2 text-sm text-ink-soft">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-pine-700" />
          <span>
            {bloqueada.bloqueio}{' '}
            <Link to="/gestao/vagas" className="link">
              Ir para Vagas
            </Link>
          </span>
        </p>
      )}
      {acao && <EstadoModal c={c} acao={acao} onClose={() => setAcao(null)} />}
    </div>
  )
}
