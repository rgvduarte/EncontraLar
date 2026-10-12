import { forwardRef, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { FieldShell } from '@/components/ui/Field'
import { LUGARES, type LugarPesquisa } from '@/data/localidades'
import { cn } from '@/lib/cn'
import { normalizar } from '../shared/validators'
import { distritoTexto } from '../shared/lugar'
import { controlClass } from '../shared/control'

const MAX = 8

/** Sugestões: primeiro as que começam pelo texto, depois as que o contêm (sem acentos). */
function sugerir(q: string): LugarPesquisa[] {
  const n = normalizar(q)
  if (!n) return []
  const comeca: LugarPesquisa[] = []
  const contem: LugarPesquisa[] = []
  for (const l of LUGARES) {
    const label = normalizar(l.label)
    if (label.startsWith(n) || label.split(/[\s—-]+/).some((p) => p.startsWith(n))) comeca.push(l)
    else if (label.includes(n) || normalizar(l.distrito).startsWith(n)) contem.push(l)
  }
  return [...comeca, ...contem].slice(0, MAX)
}

/** Devolve o label oficial se o texto corresponder exatamente a um lugar (ignora maiúsculas e acentos). */
export function lugarCanonico(texto: string): string | null {
  const n = normalizar(texto)
  return LUGARES.find((l) => normalizar(l.label) === n)?.label ?? null
}

export const lugarPorLabel = (label: string) => LUGARES.find((l) => l.label === label)

function Realce({ texto, q }: { texto: string; q: string }) {
  const n = normalizar(q)
  const i = n ? normalizar(texto).indexOf(n) : -1
  if (i < 0) return <>{texto}</>
  return (
    <>
      {texto.slice(0, i)}
      <mark className="bg-transparent font-semibold text-ink">{texto.slice(i, i + n.length)}</mark>
      {texto.slice(i + n.length)}
    </>
  )
}

/**
 * Combobox acessível (ARIA 1.2, "list autocomplete") para escolher a localidade a partir de LUGARES.
 * Setas para navegar, Enter para escolher, Esc para fechar.
 */
export const LugarCombobox = forwardRef<
  HTMLInputElement,
  {
    label: string
    hint?: string
    error?: ReactNode
    value: string
    name?: string
    onChange: (v: string) => void
    onBlur: () => void
  }
>(function LugarCombobox({ label, hint, error, value, name, onChange, onBlur }, ref) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const opcoes = useMemo(() => sugerir(value), [value])
  const escolhido = lugarCanonico(value)
  const mostrar = open && opcoes.length > 0 && !(opcoes.length === 1 && opcoes[0]!.label === escolhido)
  const optId = (i: number) => `${listId}-opt-${i}`

  useEffect(() => setActive(-1), [value])
  useEffect(() => {
    if (mostrar && active >= 0) document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, mostrar, listId])

  const escolher = (l: LugarPesquisa) => {
    onChange(l.label)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = opcoes.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (n ? (a + 1) % n : -1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (n ? (a <= 0 ? n - 1 : a - 1) : -1))
    } else if (e.key === 'Enter' && mostrar) {
      // com a lista aberta, Enter escolhe (e não submete o formulário)
      e.preventDefault()
      const alvo = opcoes[active >= 0 ? active : 0]
      if (alvo) escolher(alvo)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            name={name}
            type="text"
            role="combobox"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-autocomplete="list"
            aria-expanded={mostrar}
            aria-controls={listId}
            aria-activedescendant={mostrar && active >= 0 ? optId(active) : undefined}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setOpen(true)
            }}
            onFocus={() => value && !escolhido && setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              setOpen(false)
              // aceita "evora" como "Évora"
              if (escolhido && escolhido !== value) onChange(escolhido)
              onBlur()
            }}
            className={controlClass}
          />
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={`Sugestões para ${label.toLowerCase()}`}
            hidden={!mostrar}
            data-lenis-prevent
            className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(20rem,45dvh)] origin-top animate-pop-in overflow-auto overscroll-contain rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-line motion-reduce:animate-none"
          >
            {opcoes.map((l, i) => (
              <li
                key={l.label}
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(l)}
                onMouseMove={() => active !== i && setActive(i)}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2',
                  i === active ? 'bg-sand' : '',
                )}
              >
                <span className="text-ink">
                  <Realce texto={l.label} q={value} />
                </span>
                <span className="shrink-0 text-right text-sm text-ink-mute">{distritoTexto(l.distrito)}</span>
              </li>
            ))}
          </ul>
          <p id={`${listId}-status`} aria-live="polite" className="sr-only">
            {open && value.trim() && !escolhido
              ? opcoes.length
                ? `${opcoes.length} ${opcoes.length === 1 ? 'sugestão' : 'sugestões'}. Use as setas para escolher.`
                : 'Sem sugestões para este texto.'
              : ''}
          </p>
          {open && value.trim().length >= 2 && opcoes.length === 0 && (
            <p className="mt-2 text-sm text-ink-mute">
              Não encontrámos «{value.trim()}». Escreva o concelho ou a cidade mais próxima.
            </p>
          )}
        </div>
      )}
    </FieldShell>
  )
})
