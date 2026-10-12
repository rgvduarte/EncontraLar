import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useDismiss } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { pillClasses } from './Chips'

interface Props {
  /** texto da pílula */
  label: ReactNode
  /** nome acessível do painel */
  panelLabel: string
  active: boolean
  children: ReactNode
  /** chamado quando o painel fecha (para aplicar valores pendentes) */
  onClose?: () => void
  panelClassName?: string
}

/** Pílula que abre um pequeno painel por baixo (Tipo, Orçamento). Esc ou clique fora fecham. */
export function PillPopover({ label, panelLabel, active, children, onClose, panelClassName }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const close = useCallback(() => {
    setOpen(false)
    onCloseRef.current?.()
    btnRef.current?.focus()
  }, [])
  useDismiss(open, ref, close)

  // alinhar à direita quando o painel não cabe à direita da pílula
  const [direita, setDireita] = useState(false)
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) return
    const b = ref.current.getBoundingClientRect()
    setDireita(b.left + panelRef.current.offsetWidth > document.documentElement.clientWidth - 16)
  }, [open])

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className={pillClasses(active || (open ? 'aberta' : false), 'pr-3.5 pl-4.5')}
      >
        {label}
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={panelLabel}
          className={cn(
            'absolute top-full z-50 mt-2 w-[22rem] animate-pop-in rounded-[1.5rem] bg-white p-6 shadow-lift ring-1 ring-black/5',
            direita ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
