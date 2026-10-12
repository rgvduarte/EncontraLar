import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Building2, Map as MapIcon, MapPin } from 'lucide-react'
import type { Lar } from '@/types'
import { cn } from '@/lib/cn'
import { normalizar, sugerir, type Opcao } from './search'

/** Realça a parte do texto que corresponde à pesquisa (comparação sem acentos). */
function Realce({ texto, q }: { texto: string; q: string }) {
  const n = normalizar(q.trim())
  const i = n ? normalizar(texto).indexOf(n) : -1
  if (i < 0) return <>{texto}</>
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded-[3px] bg-sun-100 text-ink">{texto.slice(i, i + n.length)}</mark>
      {texto.slice(i + n.length)}
    </>
  )
}

const ICONE = { lugar: MapPin, distrito: MapIcon, lar: Building2 }

/**
 * Combobox acessível (padrão ARIA 1.2 "list autocomplete"): role=combobox + listbox,
 * setas para navegar, Enter para escolher, Esc para fechar.
 */
export function PlaceCombobox({
  inputId,
  value,
  onValueChange,
  onPick,
  lares,
  describedBy,
  trailing,
}: {
  inputId: string
  value: string
  onValueChange: (v: string) => void
  onPick: (o: Opcao) => void
  lares: Lar[]
  describedBy?: string
  /** elemento dentro do campo, à direita (ex.: limpar) */
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const opcoes = useMemo(() => sugerir(value, lares), [value, lares])
  const vazio = !value.trim()
  const optId = (i: number) => `${listId}-opt-${i}`
  const mostrar = open && opcoes.length > 0

  // ao mudar o texto, a primeira sugestão fica pronta para Enter
  useEffect(() => setActive(vazio ? -1 : 0), [value, vazio])

  useEffect(() => {
    if (!mostrar || active < 0) return
    listRef.current?.querySelector(`#${CSS.escape(`${listId}-opt-${active}`)}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, mostrar, listId])

  const escolher = (o: Opcao) => {
    onPick(o)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = opcoes.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        setActive((a) => (n ? (a + 1) % n : -1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) setOpen(true)
        setActive((a) => (n ? (a <= 0 ? n - 1 : a - 1) : -1))
        break
      case 'Enter':
        if (mostrar && active >= 0 && opcoes[active]) {
          e.preventDefault()
          escolher(opcoes[active]!)
        }
        break
      case 'Escape':
        if (mostrar) {
          e.preventDefault()
          setOpen(false)
        } else if (value) {
          e.preventDefault()
          onValueChange('')
        }
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="relative">
      <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-pine-700" />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={listId}
        aria-activedescendant={mostrar && active >= 0 ? optId(active) : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Concelho ou cidade"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          'min-h-16 w-full rounded-2xl border-2 border-line-strong bg-white pr-14 pl-13 text-lg font-semibold text-ink',
          'placeholder:font-normal placeholder:text-ink-mute transition-colors hover:border-pine-400 focus:border-pine-700 focus:outline-none',
          'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
        )}
      />
      {trailing && <div className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</div>}

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={vazio ? 'Localidades com mais instituições' : 'Sugestões'}
        hidden={!mostrar}
        // impede que o campo perca o foco ao clicar numa sugestão
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full z-50 mt-2 max-h-[22rem] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-1.5 shadow-lift"
      >
        {vazio && (
          <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">
            Onde há mais instituições
          </li>
        )}
        {opcoes.map((o, i) => {
          const Icon = ICONE[o.kind]
          const sel = i === active
          return (
            <li
              key={o.id}
              id={optId(i)}
              role="option"
              aria-selected={sel}
              onClick={() => escolher(o)}
              onMouseMove={() => setActive(i)}
              className={cn(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2',
                sel ? 'bg-pine-50 ring-1 ring-pine-200' : 'hover:bg-sand/70',
              )}
            >
              <Icon aria-hidden className={cn('size-5 shrink-0', o.kind === 'lar' ? 'text-terra-600' : 'text-pine-700')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  <Realce texto={o.label} q={value} />
                </span>
                <span className="block truncate text-sm text-ink-soft">{o.categoria}</span>
              </span>
              <span className="shrink-0 text-right text-sm leading-tight">
                {o.kind === 'lar' ? (
                  <span className={cn('font-bold', o.comVaga ? 'text-leaf-700' : 'text-ink-mute')}>{o.comVaga ? 'Com vaga' : 'Sem vaga hoje'}</span>
                ) : (
                  <>
                    <span className="block font-bold text-ink tabular">{o.total} {o.total === 1 ? 'instituição' : 'instituições'}</span>
                    <span className={cn('block tabular', o.comVaga ? 'font-semibold text-leaf-700' : 'text-ink-mute')}>
                      {o.comVaga ? `${o.comVaga} com vaga` : 'sem vagas hoje'}
                    </span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {open && !vazio ? (opcoes.length ? `${opcoes.length} sugestões. Use as setas para escolher.` : 'Sem sugestões para este texto.') : ''}
      </p>
    </div>
  )
}
