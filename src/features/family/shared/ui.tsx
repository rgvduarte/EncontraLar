import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Candidatura } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button, type ButtonVariant } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ESTADO_META } from './estado'

export function EstadoBadge({ estado, size = 'sm', className }: { estado: Candidatura['estado']; size?: 'sm' | 'md'; className?: string }) {
  const m = ESTADO_META[estado]
  return (
    <Badge tone={m.tone} size={size} icon={<m.icon aria-hidden />} className={className}>
      {ESTADO_CANDIDATURA_LABEL[estado]}
    </Badge>
  )
}

/** Diálogo de confirmação para ações com consequências (aceitar vaga, cancelar pedido, apagar perfil…). */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Voltar',
  confirmVariant = 'primary',
  confirmIcon,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  confirmVariant?: ButtonVariant
  confirmIcon?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} icon={confirmIcon} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/** Cabeçalho de bloco dentro do painel: título em Fraunces + ligação "ver mais" opcional. */
export function BlockHeading({
  id,
  title,
  kicker,
  action,
  className,
}: {
  id?: string
  title: ReactNode
  kicker?: ReactNode
  action?: { to: string; label: string }
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-1', className)}>
      <div>
        {kicker && <p className="eyebrow mb-1">{kicker}</p>}
        <h2 id={id} className="font-display text-2xl font-semibold text-ink">
          {title}
        </h2>
      </div>
      {action && (
        <Link to={action.to} className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
          {action.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  )
}

/** Recorte "bilhete" — semicírculos nas margens e linha picotada. */
export function Perforation({ notchClass = 'bg-cream', className }: { notchClass?: string; className?: string }) {
  return (
    <div aria-hidden className={cn('relative h-6', className)}>
      <span className={cn('absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full', notchClass)} />
      <span className={cn('absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full', notchClass)} />
      <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line-strong" />
    </div>
  )
}
