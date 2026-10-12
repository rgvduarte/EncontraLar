import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { Building2, LoaderCircle, LocateFixed, Map as MapIcon, MapPin, Search, X } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/hooks'
import { useLenis } from '@/components/motion/SmoothScroll'
import { distanciaAoMaisProximo, normalizar, resolverTexto, sugerir, urlPesquisa, type Opcao } from './search'

const ICONE = { lugar: MapPin, distrito: MapIcon, lar: Building2 }

/** Realça a parte do texto que corresponde à pesquisa (comparação sem acentos). */
function Realce({ texto, q }: { texto: string; q: string }) {
  const n = normalizar(q.trim())
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

type EstadoGeo = { s: 'idle' } | { s: 'loading' } | { s: 'erro'; msg: string }

/**
 * Pesquisa em forma de pílula: combobox acessível (padrão ARIA 1.2 "list autocomplete") sobre os lugares,
 * botão "Perto de mim" e "Procurar". Escolher uma sugestão leva logo aos resultados.
 */
export function SearchPill({ lares }: { lares: Lar[] }) {
  const navigate = useNavigate()
  const inputId = useId()
  const listId = useId()
  const erroId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [texto, setTexto] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [geo, setGeo] = useState<EstadoGeo>({ s: 'idle' })
  const largo = useMediaQuery('(min-width: 640px)')
  const lenis = useLenis()
  const formRef = useRef<HTMLFormElement>(null)

  /** No telemóvel, sobe a pesquisa para o topo para que as sugestões não fiquem por baixo do teclado. */
  const subirNoTelemovel = () => {
    const form = formRef.current
    if (largo || !form) return
    const alvo = window.scrollY + form.getBoundingClientRect().top - 80
    if (alvo <= window.scrollY + 4) return
    if (lenis) lenis.scrollTo(alvo)
    else window.scrollTo({ top: alvo, behavior: 'smooth' })
  }

  const opcoes = useMemo(() => sugerir(texto, lares), [texto, lares])
  const vazio = !texto.trim()
  const mostrar = open && opcoes.length > 0
  const optId = (i: number) => `${listId}-opt-${i}`

  // ao escrever, a primeira sugestão fica pronta para Enter
  useEffect(() => setActive(vazio ? -1 : 0), [texto, vazio])

  useEffect(() => {
    if (!mostrar || active < 0) return
    listRef.current?.querySelector(`#${CSS.escape(`${listId}-opt-${active}`)}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, mostrar, listId])

  const escolher = (o: Opcao) => {
    setOpen(false)
    if (o.kind === 'lar' && o.larId) navigate(`/lar/${o.larId}`)
    else if (o.kind === 'lugar' && o.lugar) navigate(urlPesquisa({ kind: 'lugar', lugar: o.lugar }))
    else if (o.kind === 'distrito' && o.distrito) navigate(urlPesquisa({ kind: 'distrito', distrito: o.distrito }))
  }

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    // o botão "Procurar" segue a sugestão realçada (lugar ou distrito), tal como a tecla Enter
    const o = !vazio && active >= 0 ? opcoes[active] : undefined
    if (o && o.kind !== 'lar') {
      escolher(o)
      return
    }
    const destino = resolverTexto(texto)
    navigate(urlPesquisa(destino, destino ? undefined : texto))
  }

  const pertoDeMim = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ s: 'erro', msg: 'Este navegador não partilha a localização. Escreva o nome da localidade.' })
      return
    }
    setGeo({ s: 'loading' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (distanciaAoMaisProximo(coords.latitude, coords.longitude) > 60) {
          setGeo({ s: 'erro', msg: 'Parece estar fora das zonas que cobrimos. Escreva a localidade onde procura.' })
          return
        }
        setGeo({ s: 'idle' })
        navigate(urlPesquisa({ kind: 'geo', lat: coords.latitude, lng: coords.longitude }))
      },
      (err) =>
        setGeo({
          s: 'erro',
          msg:
            err.code === err.PERMISSION_DENIED
              ? 'Sem autorização para usar a localização. Escreva o nome da localidade.'
              : 'Não conseguimos obter a sua localização. Tente de novo ou escreva a localidade.',
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = opcoes.length
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setOpen(true)
        setActive((a) => (n ? (a + 1) % n : -1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setOpen(true)
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
        } else if (texto) {
          e.preventDefault()
          setTexto('')
        }
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const localizando = geo.s === 'loading'

  return (
    <div className="relative z-20 mx-auto w-full max-w-2xl">
      <form
        ref={formRef}
        role="search"
        aria-label="Procurar lares e residências"
        onSubmit={submeter}
        className={cn(
          'flex h-16 items-center gap-0.5 rounded-full bg-white pr-2 pl-4 shadow-card ring-1 ring-line sm:h-[4.5rem] sm:gap-1 sm:pl-6',
          'transition-shadow duration-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-terra-500',
        )}
      >
        <Search aria-hidden className="hidden size-5 shrink-0 text-ink-mute sm:block" />
        <label htmlFor={inputId} className="sr-only">
          Onde procura? Cidade, concelho ou nome da instituição
        </label>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mostrar}
          aria-controls={listId}
          aria-activedescendant={mostrar && active >= 0 ? optId(active) : undefined}
          aria-describedby={geo.s === 'erro' ? erroId : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={largo ? 'Cidade ou concelho' : 'Onde procura?'}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setOpen(true)
            if (geo.s === 'erro') setGeo({ s: 'idle' })
          }}
          onFocus={() => {
            setOpen(true)
            subirNoTelemovel()
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-mute focus-visible:outline-none sm:pl-2 sm:text-lg"
        />
        {texto && (
          <button
            type="button"
            onClick={() => setTexto('')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand hover:text-ink"
          >
            <X aria-hidden className="size-4.5" />
            <span className="sr-only">Limpar</span>
          </button>
        )}
        <button
          type="button"
          onClick={pertoDeMim}
          disabled={localizando}
          title="Procurar perto da minha localização"
          aria-describedby={geo.s === 'erro' ? erroId : undefined}
          className="flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-sand hover:text-ink disabled:cursor-wait"
        >
          {localizando ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <LocateFixed aria-hidden className="size-5" />}
          <span className="sr-only sm:not-sr-only">{localizando ? 'A localizar…' : 'Perto de mim'}</span>
        </button>
        <Button type="submit" className="h-12 shrink-0 px-4 sm:px-7">
          Procurar
        </Button>
      </form>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={vazio ? 'Onde há mais instituições' : 'Sugestões'}
        hidden={!mostrar}
        // impede que o campo perca o foco ao clicar numa sugestão
        onMouseDown={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-full mt-3 max-h-[24rem] animate-fade-in overflow-y-auto overscroll-contain rounded-[1.5rem] bg-white p-2 text-left shadow-lift ring-1 ring-black/5"
      >
        {vazio && (
          <li role="presentation" className="px-4 pt-2 pb-1 text-sm text-ink-mute">
            Onde há mais instituições
          </li>
        )}
        {opcoes.map((o, i) => {
          const Icon = ICONE[o.kind]
          return (
            <li
              key={o.id}
              id={optId(i)}
              role="option"
              aria-selected={i === active}
              onClick={() => escolher(o)}
              onMouseMove={() => setActive(i)}
              className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-4 py-2', i === active && 'bg-sand')}
            >
              <Icon aria-hidden className="size-5 shrink-0 text-ink-mute" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink-soft">
                  <Realce texto={o.label} q={texto} />
                </span>
                <span className="block truncate text-sm text-ink-mute">
                  {o.kind === 'lugar' && o.detalhe.includes(' · ') ? (
                    <>
                      {o.detalhe.split(' · ')[0]}
                      <span className="hidden sm:inline"> · {o.detalhe.split(' · ')[1]}</span>
                    </>
                  ) : (
                    o.detalhe
                  )}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm leading-snug tabular">
                {o.kind === 'lar' ? (
                  <span className={o.comVaga ? 'font-medium text-leaf-700' : 'text-ink-mute'}>{o.comVaga ? 'Com vaga' : 'Sem vaga hoje'}</span>
                ) : (
                  <>
                    <span className={cn('block', o.comVaga ? 'font-medium text-leaf-700' : 'text-ink-mute')}>
                      {o.comVaga ? `${o.comVaga} com vaga` : 'Sem vaga hoje'}
                    </span>
                    <span className="hidden text-ink-mute sm:block">
                      {o.total} {o.total === 1 ? 'instituição' : 'instituições'}
                    </span>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {open && !vazio ? (opcoes.length ? `${opcoes.length} sugestões. Use as setas para escolher.` : 'Sem sugestões. Carregue em Procurar para pesquisar pelo nome.') : ''}
      </p>
      {geo.s === 'erro' && (
        <p id={erroId} role="alert" className="mt-4 text-center text-sm text-alert-700">
          {geo.msg}
        </p>
      )}
    </div>
  )
}
