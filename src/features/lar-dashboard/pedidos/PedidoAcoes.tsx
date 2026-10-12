import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { MoreLink } from '../shared/ui'
import { acoesDoPedido, type Acao } from './acoes'
import { EstadoModal } from './EstadoModal'

/** Botões de ação de um pedido (pílulas) + diálogo de confirmação com nota para a família. */
export function PedidoAcoes({
  c,
  lar,
  agora,
  className,
  apenasPrincipal,
  discreto,
}: {
  c: Candidatura
  lar: Lar
  agora?: number
  className?: string
  /** mostra só a primeira ação (as restantes ficam no detalhe do pedido) */
  apenasPrincipal?: boolean
  /** a ação principal fica cinzenta (quando outra linha é a sugerida) */
  discreto?: boolean
}) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const todas = acoesDoPedido(c, lar, agora)
  const acoes = apenasPrincipal ? todas.slice(0, 1) : todas

  if (c.estado === 'aceite') {
    return (
      <p className={cn('inline-flex min-h-12 items-center gap-2 font-medium text-leaf-700', className)}>
        <Check aria-hidden className="size-5" strokeWidth={2.5} /> Entrada confirmada
      </p>
    )
  }
  if (!acoes.length) return null
  const bloqueada = acoes.find((a) => a.bloqueio)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {acoes.map((a, i) => (
          <Button key={a.id} variant={discreto && i === 0 ? 'subtle' : a.variant} disabled={Boolean(a.bloqueio)} onClick={() => setAcao(a)}>
            {a.label}
          </Button>
        ))}
      </div>
      {bloqueada && (
        <p className="max-w-md text-sm text-ink-mute">
          {bloqueada.bloqueio}{' '}
          <MoreLink to="/gestao/vagas" className="text-sm">
            Ir para Vagas
          </MoreLink>
        </p>
      )}
      {acao && <EstadoModal c={c} acao={acao} onClose={() => setAcao(null)} />}
    </div>
  )
}
