import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { Building2, Crosshair, Globe2, Hash, Landmark, LoaderCircle, MapPin, Search, Type, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Entrada } from './filtering'
import { construirOpcoes, type Opcao } from './placeOptions'
import { rotuloLocal, type Local } from './searchState'
import { DispGlyph } from './Chips'
import type { GeoEstado } from './useGeolocation'

interface Props {
  local: Local
  entradas: Entrada[]
  geoEstado: GeoEstado
  onLocal: (local: Local) => void
  onGeo: () => void
  onTexto: (q: string) => void
  /** compacto (barra do telemóvel) */
  compact?: boolean
  className?: string
}

const ICON: Record<Opcao['kind'], typeof MapPin> = {
  geo: Crosshair,
  pais: Globe2,
  lugar: MapPin,
  distrito: Landmark,
  lar: Building2,
  texto: Type,
}

function Meta({ n, vagas }: { n: number; vagas: number }) {
  if (n === 0) return <span className="text-xs text-ink-mute">sem instituições</span>
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft tabular">
      {n} {n === 1 ? 'instituição' : 'instituições'}
      {vagas > 0 && (
        <span className="inline-flex items-center gap-1 font-bold text-leaf-700">
          · <DispGlyph disp="disponivel" className="size-3 [&_svg]:size-3" /> {vagas} com vaga
        </span>
      )}
    </span>
  )
}

/** Campo "Onde" — combobox acessível (padrão ARIA 1.2) com localidades, distritos, códigos postais e nomes. */
export function PlaceCombobox({ local, entradas, geoEstado, onLocal, onGeo, onTexto, compact, className }: Props) {
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rotulo = rotuloLocal(local)
  const [texto, setTexto] = useState(rotulo)
  const [editando, setEditando] = useState(false)
  const [open, setOpen] = useState(false)
  const [ativo, setAtivo] = useState(0)

  // quando o local muda por fora (pílulas, mapa), o campo acompanha
  useEffect(() => {
    if (!editando) setTexto(rotulo)
  }, [rotulo, editando])

  const consulta = editando ? texto : ''
  const podeLocalizar = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const grupos = useMemo(() => (open ? construirOpcoes(consulta, entradas, podeLocalizar) : []), [open, consulta, entradas, podeLocalizar])
  const planas = useMemo(() => grupos.flatMap((g) => g.opcoes), [grupos])
  const ativoId = open && planas[ativo] ? `${uid}-${planas[ativo]!.id}` : undefined

  useEffect(() => setAtivo(0), [consulta])

  useEffect(() => {
    if (!open || !ativoId) return
    document.getElementById(ativoId)?.scrollIntoView({ block: 'nearest' })
  }, [open, ativoId])

  const fechar = (repor = true) => {
    setOpen(false)
    setEditando(false)
    if (repor) setTexto(rotulo)
  }

  const escolher = (op: Opcao) => {
    fechar(false)
    switch (op.kind) {
      case 'geo':
        setTexto(rotulo)
        onGeo()
        break
      case 'pais':
        setTexto('')
        onLocal({ tipo: 'pais' })
        break
      case 'lugar':
        setTexto(op.lugar.label)
        onLocal({ tipo: 'lugar', lugar: op.lugar })
        break
      case 'distrito':
        setTexto(`Distrito de ${op.distrito}`)
        onLocal({ tipo: 'distrito', distrito: op.distrito })
        break
      case 'lar':
        setTexto(rotulo)
        navigate(`/lar/${op.lar.id}`)
        break
      case 'texto':
        setTexto(rotulo)
        onTexto(op.q)
        break
    }
    inputRef.current?.blur()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      setAtivo((a) => Math.min(planas.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      if (open && planas[ativo]) {
        e.preventDefault()
        escolher(planas[ativo]!)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        fechar()
      }
    } else if (e.key === 'Tab') {
      fechar()
    }
  }

  const limpar = () => {
    if (editando && texto) {
      setTexto('')
      inputRef.current?.focus()
      setOpen(true)
      return
    }
    setTexto('')
    onLocal({ tipo: 'pais' })
    setEditando(true)
    setOpen(true)
    inputRef.current?.focus()
  }

  const temValor = Boolean(editando ? texto : rotulo)
  const geoAtivo = geoEstado === 'a-localizar'

  return (
    <div
      ref={wrapRef}
      role="search"
      aria-label="Procurar por localidade"
      className={cn('relative', className)}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) fechar()
      }}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border-2 bg-white pr-1.5 pl-4 transition-colors',
          open ? 'border-pine-600 shadow-card' : 'border-line-strong hover:border-pine-500',
          compact ? 'min-h-13' : 'min-h-15',
        )}
      >
        {geoAtivo ? (
          <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-pine-700" />
        ) : (
          <Search aria-hidden className="size-5 shrink-0 text-pine-700" />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
          <label htmlFor={inputId} className={cn('text-xs leading-tight font-bold tracking-[0.08em] text-pine-700 uppercase', compact && 'sr-only')}>
            Onde procura
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={ativoId}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={geoAtivo ? 'A localizar…' : 'Localidade, distrito ou código postal'}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setEditando(true)
              setOpen(true)
            }}
            onFocus={(e) => {
              setEditando(true)
              setOpen(true)
              e.currentTarget.select()
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="w-full min-w-0 truncate bg-transparent text-base font-semibold text-ink placeholder:font-normal placeholder:text-ink-mute focus:outline-none"
          />
        </div>
        {temValor && (
          <button
            type="button"
            onClick={limpar}
            aria-label={editando && texto ? 'Apagar o texto escrito' : 'Retirar a localidade e procurar em todo o país'}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-sand hover:text-ink"
          >
            <X aria-hidden className="size-5" />
          </button>
        )}
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="Sugestões de localidade"
        hidden={!open}
        className={cn(
          'absolute top-full left-0 z-50 mt-2 max-h-[min(65vh,34rem)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white p-2 shadow-lift',
          !compact && 'min-w-[30rem]',
        )}
      >
        {open && planas.length === 0 && (
          <p className="px-3 py-4 text-sm text-ink-soft">
            Não encontrámos «{texto.trim()}». Experimente o nome do concelho (ex.: Sintra), o distrito ou os 4 primeiros dígitos do código postal.
          </p>
        )}
        {grupos.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`${uid}-${g.id}`} className="py-1">
            <div id={`${uid}-${g.id}`} role="presentation" className="px-3 pt-1.5 pb-1 text-xs font-bold tracking-[0.1em] text-ink-mute uppercase">
              {g.titulo}
            </div>
            {g.opcoes.map((op) => {
              const idx = planas.indexOf(op)
              const Icon = op.kind === 'lugar' && op.cp ? Hash : ICON[op.kind]
              const sel = idx === ativo
              return (
                <div
                  key={op.id}
                  id={`${uid}-${op.id}`}
                  role="option"
                  aria-selected={sel}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(op)}
                  onMouseMove={() => idx !== ativo && setAtivo(idx)}
                  className={cn(
                    'flex min-h-13 cursor-pointer items-center gap-3 rounded-xl px-3 py-2',
                    sel ? 'bg-pine-50 ring-1 ring-pine-200' : 'hover:bg-sand/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      op.kind === 'geo' ? 'bg-pine-700 text-white' : 'bg-sand text-pine-700',
                    )}
                  >
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <OpcaoTexto op={op} />
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function OpcaoTexto({ op }: { op: Opcao }) {
  switch (op.kind) {
    case 'geo':
      return (
        <>
          <span className="font-bold text-ink">Perto de mim</span>
          <span className="text-xs text-ink-soft">Usar a localização deste dispositivo</span>
        </>
      )
    case 'pais':
      return (
        <>
          <span className="font-bold text-ink">Todo o país</span>
          <Meta n={op.n} vagas={op.vagas} />
        </>
      )
    case 'lugar': {
      const [cidade, zona] = op.lugar.label.split(' — ')
      return (
        <>
          <span className="truncate font-bold text-ink">
            {op.cp && <span className="mr-1.5 font-normal text-ink-mute tabular">{op.cp}</span>}
            {cidade}
            {zona && <span className="font-normal text-ink-soft"> — {zona}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-mute">
            <span>
              {op.lugar.distrito !== cidade && `${op.lugar.distrito} · `}raio de {op.lugar.raio} km ·
            </span>
            <Meta n={op.n} vagas={op.vagas} />
          </span>
        </>
      )
    }
    case 'distrito':
      return (
        <>
          <span className="font-bold text-ink">Distrito de {op.distrito}</span>
          <Meta n={op.n} vagas={op.vagas} />
        </>
      )
    case 'lar':
      return (
        <>
          <span className="truncate font-bold text-ink">{op.lar.nome}</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <DispGlyph disp={op.disp} className="size-3 [&_svg]:size-3" />
            {op.lar.localidade} · abrir a ficha
          </span>
        </>
      )
    case 'texto':
      return (
        <>
          <span className="truncate font-bold text-ink">Instituições com «{op.q}» no nome</span>
          <span className="text-xs text-ink-soft">Mantém a localidade escolhida</span>
        </>
      )
  }
}
