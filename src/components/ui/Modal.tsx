import { useEffect, useRef, useState, type ReactNode } from 'react'
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

/**
 * Diálogo modal com <dialog> nativo (foco preso, Esc fecha, leitor de ecrã anuncia).
 * Desktop: cartão centrado que entra com escala suave. Telemóvel: folha que sobe do fundo
 * (mais ergonómica — ações ao alcance do polegar). Anima também ao fechar.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setMounted(true)
      setClosing(false)
      if (!d.open) d.showModal()
      return
    }
    if (d.open) {
      setClosing(true)
      const t = window.setTimeout(() => {
        d.close()
        setClosing(false)
        setMounted(false)
      }, 220)
      return () => window.clearTimeout(t)
    }
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
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      data-lenis-prevent
      className={cn(
        'overflow-hidden bg-white p-0 text-ink shadow-lift',
        'backdrop:bg-black/35 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-300',
        // telemóvel: folha inferior
        'max-sm:mx-0 max-sm:mt-auto max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-[1.75rem]',
        'max-sm:open:animate-sheet-up',
        // desktop: cartão centrado
        'sm:m-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:rounded-[1.75rem] sm:open:animate-[pop-in_.32s_cubic-bezier(.16,1,.3,1)_both]',
        size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl',
        closing && 'pointer-events-none opacity-0 transition-[opacity,transform] duration-200 max-sm:translate-y-8 sm:scale-[0.98] backdrop:opacity-0',
      )}
    >
      {mounted && (
        <div className="flex max-h-[inherit] flex-col sm:max-h-[calc(100dvh-3rem)]">
          <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-sand-deep sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-2 sm:px-7 sm:pt-7">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-mute">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-sand text-ink-soft transition-colors hover:bg-sand-deep hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-6 py-4 sm:px-7 sm:py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-sm:[&>*]:flex-1 sm:px-7 sm:pb-5">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
