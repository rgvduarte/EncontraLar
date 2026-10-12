import { useSyncExternalStore } from 'react'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'info' | 'error'
interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  text?: string
}

let items: ToastItem[] = []
let counter = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(tone: ToastTone, title: string, text?: string) {
  const id = ++counter
  items = [...items, { id, tone, title, text }]
  emit()
  setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5500)
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

/** toast.success('Guardado', 'Texto opcional') */
export const toast = {
  success: (title: string, text?: string) => push('success', title, text),
  info: (title: string, text?: string) => push('info', title, text),
  error: (title: string, text?: string) => push('error', title, text),
}

const ICON = { success: CircleCheck, info: Info, error: TriangleAlert }
const TONE = {
  success: '[&_.ico]:text-leaf-500',
  info: '[&_.ico]:text-terra-600',
  error: '[&_.ico]:text-alert-600',
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => items,
  )
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[2000] flex flex-col items-center gap-3 px-4 sm:right-6 sm:left-auto sm:items-end"
    >
      {list.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-md animate-fade-up items-start gap-3 rounded-[1.25rem] bg-white/95 p-4 shadow-lift ring-1 ring-black/5 backdrop-blur-xl',
              TONE[t.tone],
            )}
          >
            <Icon aria-hidden className="ico mt-0.5 size-6 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.text && <p className="text-sm text-ink-soft">{t.text}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="-m-1 flex size-10 items-center justify-center rounded-full text-ink-mute hover:bg-sand"
            >
              <X className="size-5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
