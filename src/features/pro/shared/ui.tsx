import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Clock } from 'lucide-react'
import type { EstadoCandidatura, EstadoCaso } from '@/types'
import { Button, type ButtonVariant } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ESTADO_CASO_LABEL, type Alta } from './caso'

const CASO_DOT: Record<EstadoCaso, string> = { aberto: 'bg-terra-600', colocado: 'bg-leaf-500', fechado: 'bg-dusk-500' }

/** Estado do caso: ponto + texto (nunca só cor). */
export function EstadoCasoChip({ estado, className }: { estado: EstadoCaso; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-7 items-center gap-2 rounded-full bg-sand px-3 text-sm font-medium whitespace-nowrap text-ink', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', CASO_DOT[estado])} />
      <span>
        <span className="sr-only">Caso </span>
        {ESTADO_CASO_LABEL[estado]}
      </span>
    </span>
  )
}

/** Contagem até à alta: destaque a vermelho quando faltam 2 dias ou menos (ou já passou) num caso aberto. */
export function AltaChip({ alta, className }: { alta: Alta; className?: string }) {
  return (
    <span
      title={alta.extenso || undefined}
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap tabular',
        alta.urgente ? 'bg-alert-50 text-alert-700' : alta.dias == null ? 'bg-sand text-ink-mute' : 'bg-sand text-ink',
        className,
      )}
    >
      <Clock aria-hidden className="size-3.5 shrink-0" />
      {alta.texto}
    </span>
  )
}

const PEDIDO_DOT: Record<EstadoCandidatura, string> = {
  enviada: 'bg-dusk-500',
  em_analise: 'bg-dusk-500',
  lista_espera: 'bg-dusk-500',
  vaga_proposta: 'bg-terra-600',
  aceite: 'bg-leaf-500',
  admitida: 'bg-leaf-500',
  recusada: 'bg-line-strong',
  cancelada: 'bg-line-strong',
}

/** Estado de um pedido: ponto + texto. */
export function EstadoPedido({ estado, className }: { estado: EstadoCandidatura; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', PEDIDO_DOT[estado])} />
      {ESTADO_CANDIDATURA_LABEL[estado]}
    </span>
  )
}

/** Ligação de texto estilo Apple ("Ver ficha ›"). */
export function MaisLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('link inline-flex min-h-11 items-center gap-0.5', className)}>
      {children}
      <ChevronRight aria-hidden className="size-[1.05em] translate-y-px" />
    </Link>
  )
}

/** Diálogo de confirmação (ações com consequências: fechar o caso, cancelar um pedido, aceitar uma vaga…). */
export function Confirmar({
  open,
  onClose,
  onConfirm,
  onClosed,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Voltar',
  confirmVariant = 'primary',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  onClosed?: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-ink-soft">{children}</div>
    </Modal>
  )
}
