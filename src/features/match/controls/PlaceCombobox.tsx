import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import type { Lar } from '@/types'
import { LUGARES, type LugarPesquisa } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Local } from '../model'
import { residenciais } from '../area'
import { deTerra } from '../language'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const LIMITE = 8

/** Pesquisa de localidade (combobox ARIA 1.2 com lista): setas, Enter para escolher, Esc para fechar. */
export function PlaceCombobox({
  value,
  onChange,
  lares,
  error,
  label,
  hint,
}: {
  value: Local | null
  onChange: (l: Local | null) => void
  lares: Lar[]
  error?: string
  label: string
  hint?: string
}) {
  const id = useId()
  const listId = `${id}-lista`
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(value?.label ?? '')
  const [open, setOpen] = useState(false)
  const [ativo, setAtivo] = useState(-1)

  // se o valor mudar por fora (ex.: "perto de mim", atalho), o texto acompanha
  const [ultimoValor, setUltimoValor] = useState(value?.label)
  if (value?.label !== ultimoValor) {
    setUltimoValor(value?.label)
    if (value) setQuery(value.label)
  }

  const res = useMemo(() => residenciais(lares), [lares])

  // peso de cada lugar = nº de instituições à volta (Porto antes de Portalegre ao escrever "Por")
  const peso = useMemo(
    () => new Map(LUGARES.map((l) => [l.label, res.filter((x) => distanceKm(l, x) <= l.raio + 5).length])),
    [res],
  )

  const opcoes = useMemo(() => {
    const q = norm(query)
    if (!q) return [] as LugarPesquisa[]
    const comeca: LugarPesquisa[] = []
    const contem: LugarPesquisa[] = []
    for (const l of LUGARES) {
      const n = norm(l.label)
      const d = norm(l.distrito)
      if (n.startsWith(q) || n.split(/[\s—-]+/).some((p) => p.startsWith(q))) comeca.push(l)
      else if (n.includes(q) || d.startsWith(q)) contem.push(l)
    }
    const ordem = (a: LugarPesquisa, b: LugarPesquisa) =>
      Number(norm(b.label) === q) - Number(norm(a.label) === q) ||
      Number(a.label.includes(' — ')) - Number(b.label.includes(' — ')) ||
      (peso.get(b.label) ?? 0) - (peso.get(a.label) ?? 0)
    return [...comeca.sort(ordem), ...contem.sort(ordem)].slice(0, LIMITE)
  }, [query, peso])

  const mostrar = open && opcoes.length > 0
  const semResultados = open && query.trim().length > 1 && opcoes.length === 0 && value?.label !== query

  const escolher = (l: LugarPesquisa) => {
    onChange({ label: l.label, lat: l.lat, lng: l.lng })
    setQuery(l.label)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setAtivo((a) => (opcoes.length ? (a + 1) % opcoes.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => (opcoes.length ? (a <= 0 ? opcoes.length - 1 : a - 1) : -1))
    } else if (e.key === 'Enter') {
      // Enter escolhe a opção ativa (ou a primeira, se ainda não usou as setas)
      const alvo = opcoes[Math.max(0, ativo)]
      if (mostrar && alvo) {
        e.preventDefault()
        escolher(alvo)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      } else if (query) {
        e.preventDefault()
        setQuery('')
        onChange(null)
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 text-sm text-ink-mute">
          {hint}
        </p>
      )}
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-mute" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={mostrar}
          aria-controls={listId}
          aria-activedescendant={mostrar && opcoes[ativo] ? `${listId}-${ativo}` : undefined}
          aria-describedby={[hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Ex.: Porto, Almada, Viseu…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setAtivo(-1)
            if (value && e.target.value !== value.label) onChange(null)
          }}
          onFocus={() => query && !value && setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(
            'min-h-14 w-full rounded-2xl border bg-white py-3 pr-14 pl-12 text-lg text-ink placeholder:text-ink-mute',
            'transition-[border-color,box-shadow] duration-200 hover:border-pine-400 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none',
            error ? 'border-alert-600' : 'border-line-strong',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              onChange(null)
              inputRef.current?.focus()
            }}
            aria-label="Limpar localidade"
            className="absolute top-1/2 right-1.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-mute hover:bg-sand hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
        <ul
          id={listId}
          role="listbox"
          aria-label="Localidades sugeridas"
          className={cn(
            'absolute inset-x-0 top-full z-30 mt-2 max-h-96 animate-fade-in overflow-y-auto rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-black/5',
            !mostrar && 'hidden',
          )}
        >
          {opcoes.map((o, i) => {
            const n = peso.get(o.label) ?? 0
            return (
              <li
                key={o.label}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(o)}
                onMouseMove={() => setAtivo(i)}
                className={cn('flex min-h-13 cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2 text-ink', i === ativo && 'bg-sand')}
              >
                <span className="flex-1">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-sm text-ink-mute">
                    {o.distrito === 'Açores'
                      ? 'Região Autónoma dos Açores'
                      : o.distrito === 'Madeira'
                        ? 'Região Autónoma da Madeira'
                        : `Distrito ${deTerra(o.distrito)}`}
                  </span>
                </span>
                <span className="text-sm whitespace-nowrap text-ink-mute tabular">{plural(n, 'instituição', 'instituições')}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        {mostrar ? `${plural(opcoes.length, 'localidade sugerida', 'localidades sugeridas')}. Use as setas para escolher.` : ''}
      </p>
      {semResultados && (
        <p className="text-sm text-ink-mute">
          Não encontrámos "{query}". Experimente o nome do concelho mais próximo, ou use a sua localização.
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-sm font-medium text-alert-700">
          {error}
        </p>
      )}
    </div>
  )
}
