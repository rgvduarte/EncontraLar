import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  /** rodapé com ações */
  footer?: ReactNode
  size?: 'md' | 'lg'
}

/** Diálogo modal com <dialog> nativo (foco preso, Esc fecha, leitor de ecrã anuncia). */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-1.5rem)] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl border border-line bg-cream p-0 text-ink shadow-lift backdrop:bg-pine-950/45 backdrop:backdrop-blur-[2px] open:animate-fade-up',
        size === 'md' ? 'max-w-lg' : 'max-w-2xl',
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-6 pt-6 pb-4">
            <div>
              <h2 className="text-2xl font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 flex size-12 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-6" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-white px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
