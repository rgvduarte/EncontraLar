import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { EstadoCandidatura } from '@/types'
import { Button, type ButtonVariant } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ESTADO_DOT } from './estado'

/** Ligação de texto estilo Apple: azul com chevron — "Ver todos ›". */
export function MoreLink({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={cn('link inline-flex min-h-12 items-center gap-0.5', className)}>
      {children}
      <ChevronRight aria-hidden className="size-[1.05em] translate-y-px" />
    </Link>
  )
}

/** Título de secção do painel com ação de texto opcional à direita. */
export function SectionHeader({
  id,
  title,
  sub,
  action,
  className,
}: {
  id?: string
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-1', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-semibold sm:text-3xl">
          {title}
        </h2>
        {sub && <p className="mt-1.5 text-ink-mute">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/** Estado do pedido: ponto + texto (nunca só cor). */
export function EstadoTag({ estado, className }: { estado: EstadoCandidatura; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', ESTADO_DOT[estado])} />
      {ESTADO_CANDIDATURA_LABEL[estado]}
    </span>
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
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
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
      <div className="text-ink-soft">{children}</div>
    </Modal>
  )
}
