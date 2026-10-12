import { useState } from 'react'
import { Check, Ellipsis } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { MoreLink } from '../shared/ui'
import { acoesDoPedido, type Acao } from './acoes'
import { AcoesFolha } from './AcoesFolha'
import { EstadoModal } from './EstadoModal'

/**
 * Ações de um pedido + diálogo de confirmação com nota para a família.
 * - `linha` (lista): pílulas no desktop; no telemóvel, a ação principal ocupa a largura toda e "⋯" abre
 *   uma folha inferior com todas as ações, o telefone, o email e o perfil completo (botões largos).
 * - `folha` (rodapé do detalhe): no telemóvel, todas as ações empilhadas a toda a largura.
 */
export function PedidoAcoes({
  c,
  lar,
  agora,
  className,
  apenasPrincipal,
  discreto,
  variante = 'linha',
  verHref,
}: {
  c: Candidatura
  lar: Lar
  agora?: number
  className?: string
  /** mostra só a primeira ação (as restantes ficam no detalhe do pedido e na folha de ações) */
  apenasPrincipal?: boolean
  /** a ação principal fica cinzenta (quando outra linha é a sugerida) */
  discreto?: boolean
  variante?: 'linha' | 'folha'
  /** ligação para o perfil completo (aparece na folha de ações do telemóvel) */
  verHref?: string
}) {
  const [acao, setAcao] = useState<Acao | null>(null)
  const [aberta, setAberta] = useState(false)
  const [folha, setFolha] = useState(false)
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
  const principal = acoes[0]!
  const escolher = (a: Acao) => {
    setAcao(a)
    setAberta(true)
  }
  const variante0 = (a: Acao, i: number) => (discreto && i === 0 ? 'subtle' : a.variant)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-2',
          variante === 'linha' ? 'max-sm:hidden' : 'max-sm:flex-col max-sm:items-stretch sm:justify-end',
        )}
      >
        {acoes.map((a, i) => (
          <Button
            key={a.id}
            variant={variante0(a, i)}
            disabled={Boolean(a.bloqueio)}
            onClick={() => escolher(a)}
            size={variante === 'folha' ? 'md' : undefined}
            className={variante === 'folha' ? 'max-sm:min-h-13 max-sm:w-full' : undefined}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {variante === 'linha' && (
        <div className="flex items-center gap-2 sm:hidden">
          <Button variant={variante0(principal, 0)} disabled={Boolean(principal.bloqueio)} onClick={() => escolher(principal)} className="min-h-13 flex-1">
            {principal.label}
          </Button>
          <Button
            variant="subtle"
            onClick={() => setFolha(true)}
            aria-label={`Mais ações para o pedido de ${c.perfil.nome}`}
            aria-haspopup="dialog"
            className="min-h-13 w-13 shrink-0 px-0"
            icon={<Ellipsis aria-hidden className="size-6!" />}
          />
        </div>
      )}

      {bloqueada && (
        <p className="max-w-md text-sm text-ink-mute">
          {bloqueada.bloqueio}{' '}
          <MoreLink to="/gestao/vagas" className="text-sm">
            Ir para Vagas
          </MoreLink>
        </p>
      )}

      {acao && <EstadoModal c={c} acao={acao} open={aberta} onClose={() => setAberta(false)} />}
      {variante === 'linha' && (
        <AcoesFolha
          open={folha}
          onClose={() => setFolha(false)}
          c={c}
          acoes={todas}
          verHref={verHref}
          onEscolher={(a) => {
            setFolha(false)
            // deixa a folha descer antes de subir a confirmação
            window.setTimeout(() => escolher(a), 180)
          }}
        />
      )}
    </div>
  )
}
