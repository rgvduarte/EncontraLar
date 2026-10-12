import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Building2, Globe2, Hash, Landmark, LoaderCircle, MapPin, Navigation, Search, Type, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Entrada } from './filtering'
import { construirOpcoes, type Opcao } from './placeOptions'
import { nomeDistrito, rotuloLocal, type Local } from './searchState'
import { DispDot } from './Chips'
import type { GeoEstado } from './useGeolocation'

interface Props {
  local: Local
  entradas: Entrada[]
  geoEstado: GeoEstado
  onLocal: (local: Local) => void
  onGeo: () => void
  onTexto: (q: string) => void
  /** controlos dentro da pílula, à direita do campo (raio, "Perto de mim") */
  trailing?: ReactNode
  /** pílula mais baixa (barra do telemóvel) */
  compact?: boolean
  className?: string
}

const ICON: Record<Opcao['kind'], typeof MapPin> = {
  geo: Navigation,
  pais: Globe2,
  lugar: MapPin,
  distrito: Landmark,
  lar: Building2,
  texto: Type,
}

function Meta({ n, vagas }: { n: number; vagas: number }) {
  if (n === 0) return <span>sem instituições</span>
  return (
    <span className="inline-flex items-center gap-1.5 tabular">
      {n} {n === 1 ? 'instituição' : 'instituições'}
      {vagas > 0 && (
        <>
          <span aria-hidden>·</span>
          <DispDot disp="disponivel" className="size-2.5" />
          {vagas} com vaga
        </>
      )}
    </span>
  )
}

/** Campo "Onde" — combobox acessível (padrão ARIA 1.2): localidades, distritos, códigos postais e nomes. */
export function PlaceCombobox({ local, entradas, geoEstado, onLocal, onGeo, onTexto, trailing, compact, className }: Props) {
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
    if (open && ativoId) document.getElementById(ativoId)?.scrollIntoView({ block: 'nearest' })
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
        setTexto(nomeDistrito(op.distrito))
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
    // ecrã tátil: tira o foco para fechar o teclado do telemóvel; com teclado/rato o foco fica no campo
    // (nunca cai no <body>: quem usa teclado ou leitor de ecrã continua onde estava)
    if (window.matchMedia('(pointer: coarse)').matches) inputRef.current?.blur()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setAtivo((a) => Math.min(planas.length - 1, a + 1))
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
    if (!(editando && texto)) onLocal({ tipo: 'pais' })
    setTexto('')
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
      data-el-combo-aberto={open || undefined}
      className={cn('relative', className)}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) fechar()
      }}
    >
      <div
        className={cn(
          'flex items-center rounded-full transition-[background-color,box-shadow] duration-200',
          compact ? 'min-h-12 pr-1 pl-4.5' : 'min-h-14 pr-1.5 pl-5',
          open
            ? 'bg-white shadow-card ring-1 ring-line'
            : // fechado mas com o foco no campo (ex.: depois de escolher com o teclado): anel de foco visível
              'bg-sand hover:bg-sand-deep/70 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-terra-500',
        )}
      >
        {geoAtivo ? (
          <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-ink-mute" />
        ) : (
          <Search aria-hidden className="size-5 shrink-0 text-ink-mute" />
        )}
        <label htmlFor={inputId} className="sr-only">
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
          autoCorrect="off"
          autoCapitalize="words"
          inputMode="search"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={geoAtivo ? 'A localizar…' : 'Cidade ou código postal'}
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
          className="min-h-12 w-full min-w-0 flex-1 truncate bg-transparent pl-3 text-base font-medium text-ink placeholder:font-normal placeholder:text-ink-mute focus:outline-none"
        />
        {temValor && (
          <button
            type="button"
            onClick={limpar}
            aria-label={editando && texto ? 'Apagar o texto escrito' : 'Retirar a localidade e procurar em todo o país'}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-white hover:text-ink',
              compact ? 'size-12' : 'size-11',
            )}
          >
            <X aria-hidden className="size-4.5" />
          </button>
        )}
        {trailing}
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label="Sugestões de localidade"
        hidden={!open}
        data-lenis-prevent
        className="el-pop absolute top-full left-0 z-50 mt-2 max-h-[min(65dvh,32rem)] w-full min-w-[min(28rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[1.5rem] bg-white p-2 shadow-lift ring-1 ring-black/5"
      >
        {open && planas.length === 0 && (
          <p className="px-3 py-4 text-sm text-ink-mute">
            {/^\d/.test(texto.trim())
              ? `Não temos o código «${texto.trim()}». Escreva a localidade (ex.: Porto).`
              : `Não encontrámos «${texto.trim()}». Experimente o concelho (ex.: Sintra), o distrito ou o código postal.`}
          </p>
        )}
        {grupos.map((g) => (
          <div key={g.id} role="group" aria-labelledby={`${uid}-${g.id}`} className="py-1">
            <div id={`${uid}-${g.id}`} role="presentation" className="px-3 pt-1.5 pb-1 text-xs font-medium text-ink-mute">
              {g.titulo}
            </div>
            {g.opcoes.map((op) => {
              const idx = planas.indexOf(op)
              const Icon = op.kind === 'lugar' && op.cp ? Hash : ICON[op.kind]
              return (
                <div
                  key={op.id}
                  id={`${uid}-${op.id}`}
                  role="option"
                  aria-selected={idx === ativo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(op)}
                  onMouseMove={() => idx !== ativo && setAtivo(idx)}
                  className={cn('flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2', idx === ativo && 'bg-sand')}
                >
                  <Icon aria-hidden className={cn('size-5 shrink-0', op.kind === 'geo' ? 'text-terra-600' : 'text-ink-mute')} strokeWidth={1.75} />
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
  const sub = 'text-sm text-ink-mute'
  switch (op.kind) {
    case 'geo':
      return (
        <>
          <span className="font-medium text-terra-600">Perto de mim</span>
          <span className={sub}>Usar a localização deste dispositivo</span>
        </>
      )
    case 'pais':
      return (
        <>
          <span className="font-medium text-ink">Todo o país</span>
          <span className={sub}>
            <Meta n={op.n} vagas={op.vagas} />
          </span>
        </>
      )
    case 'lugar': {
      const [cidade, zona] = op.lugar.label.split(' — ')
      return (
        <>
          <span className="truncate font-medium text-ink">
            {op.cp && <span className="mr-1.5 font-normal text-ink-mute tabular">{op.cp}</span>}
            {cidade}
            {zona && <span className="font-normal text-ink-mute"> — {zona}</span>}
          </span>
          <span className={sub}>
            {op.lugar.distrito !== cidade && `${op.lugar.distrito} · `}
            <Meta n={op.n} vagas={op.vagas} />
          </span>
        </>
      )
    }
    case 'distrito':
      return (
        <>
          <span className="font-medium text-ink">{nomeDistrito(op.distrito)}</span>
          <span className={sub}>
            <Meta n={op.n} vagas={op.vagas} />
          </span>
        </>
      )
    case 'lar':
      return (
        <>
          <span className="truncate font-medium text-ink">{op.lar.nome}</span>
          <span className={cn(sub, 'inline-flex items-center gap-1.5')}>
            <DispDot disp={op.disp} className="size-2.5" />
            {op.lar.localidade} · abrir a ficha
          </span>
        </>
      )
    case 'texto':
      return (
        <>
          <span className="truncate font-medium text-ink">Nome com «{op.q}»</span>
          <span className={sub}>Procurar instituições pelo nome, nesta zona</span>
        </>
      )
  }
}
