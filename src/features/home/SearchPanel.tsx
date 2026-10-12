import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle, LocateFixed, Search, X } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Field'
import { km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PlaceCombobox } from './PlaceCombobox'
import {
  RAIO_PERTO,
  contarEscolhas,
  deDistrito,
  lugarMaisProximo,
  resolverTexto,
  urlPesquisa,
  type Destino,
  type TipoEscolha,
} from './search'

const TIPOS: { id: TipoEscolha; label: string }[] = [
  { id: 'erpi', label: 'Lar' },
  { id: 'residencia', label: 'Residência sénior' },
  { id: 'centro_dia', label: 'Centro de dia' },
  { id: 'qualquer', label: 'Qualquer' },
]

type EstadoGeo = { s: 'idle' } | { s: 'loading' } | { s: 'erro'; msg: string }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Texto do resumo em direto por baixo do botão. */
function onde(destino: Destino | null): string {
  if (!destino) return 'Em todo o país'
  if (destino.kind === 'lugar') return `Em ${destino.lugar.label} e arredores (${destino.lugar.raio} km)`
  if (destino.kind === 'distrito')
    return destino.distrito === 'Madeira' || destino.distrito === 'Açores' ? `Na Região Autónoma ${deDistrito(destino.distrito)}` : `No distrito ${deDistrito(destino.distrito)}`
  return `A menos de ${RAIO_PERTO} km de si${destino.perto && !destino.longe ? `, perto de ${destino.perto.label}` : ''}`
}

export function SearchPanel({ lares }: { lares: Lar[] }) {
  const navigate = useNavigate()
  const ids = { onde: useId(), ondeHint: useId(), resumo: useId(), geoErro: useId() }
  const [texto, setTexto] = useState('')
  const [destino, setDestino] = useState<Destino | null>(null)
  const [tipo, setTipo] = useState<TipoEscolha>('qualquer')
  const [soVaga, setSoVaga] = useState(false)
  const [geo, setGeo] = useState<EstadoGeo>({ s: 'idle' })

  // se a pessoa escreveu um lugar sem escolher na lista, tentamos reconhecê-lo
  const efetivo = destino ?? resolverTexto(texto)
  const textoLivre = !efetivo && texto.trim() ? texto.trim() : undefined
  const contagem = useMemo(() => contarEscolhas(lares, { destino: efetivo, tipo }), [lares, efetivo, tipo])

  const mudarTexto = (v: string) => {
    setTexto(v)
    setDestino(null)
    if (geo.s === 'erro') setGeo({ s: 'idle' })
  }

  const pertoDeMim = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ s: 'erro', msg: 'Este navegador não permite partilhar a localização. Escreva o nome da localidade.' })
      return
    }
    setGeo({ s: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const prox = lugarMaisProximo(lat, lng)
        const longe = !prox || prox.km > 60
        setDestino({ kind: 'geo', lat, lng, perto: prox?.lugar, longe })
        setTexto(prox && !longe ? `Perto de mim · ${prox.lugar.label}` : 'Perto de mim')
        setGeo(
          longe
            ? { s: 'erro', msg: `A sua localização parece estar fora das zonas cobertas${prox ? ` (a ${km(prox.km)} de ${prox.lugar.label})` : ''}. Pode escrever outra localidade.` }
            : { s: 'idle' },
        )
      },
      (err) =>
        setGeo({
          s: 'erro',
          msg:
            err.code === err.PERMISSION_DENIED
              ? 'Não foi dada autorização para usar a localização. Pode escrever o nome da localidade.'
              : 'Não conseguimos obter a sua localização. Tente de novo ou escreva o nome da localidade.',
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    navigate(urlPesquisa({ destino: efetivo, texto: textoLivre, tipo, soVaga }))
  }

  const semVagaAqui = contagem.total > 0 && contagem.comVaga === 0
  const geoA = geo.s === 'loading'

  return (
    <form
      onSubmit={submeter}
      role="search"
      aria-label="Procurar vagas"
      className="relative rounded-[1.75rem] border border-line bg-white shadow-lift"
    >
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        {/* Onde? */}
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.onde} className="font-display text-2xl font-semibold text-ink">
            Onde?
          </label>
          <p id={ids.ondeHint} className="-mt-1.5 text-sm text-ink-soft">
            Perto de casa da sua mãe ou do seu pai, ou da sua.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="min-w-0 flex-1">
              <PlaceCombobox
                inputId={ids.onde}
                value={texto}
                onValueChange={mudarTexto}
                lares={lares}
                describedBy={[ids.ondeHint, geo.s === 'erro' ? ids.geoErro : ''].filter(Boolean).join(' ')}
                onPick={(o) => {
                  if (o.kind === 'lar' && o.larId) {
                    navigate(`/lar/${o.larId}`)
                    return
                  }
                  setTexto(o.label)
                  setGeo({ s: 'idle' })
                  if (o.kind === 'lugar' && o.lugar) setDestino({ kind: 'lugar', lugar: o.lugar })
                  if (o.kind === 'distrito' && o.distrito) setDestino({ kind: 'distrito', distrito: o.distrito })
                }}
                trailing={
                  texto ? (
                    <button
                      type="button"
                      onClick={() => mudarTexto('')}
                      className="flex size-11 items-center justify-center rounded-full text-ink-mute hover:bg-sand hover:text-ink"
                    >
                      <X aria-hidden className="size-5" />
                      <span className="sr-only">Limpar localidade</span>
                    </button>
                  ) : null
                }
              />
            </div>
            <button
              type="button"
              onClick={pertoDeMim}
              disabled={geoA}
              aria-describedby={geo.s === 'erro' ? ids.geoErro : undefined}
              className={cn(
                'inline-flex min-h-16 shrink-0 items-center justify-center gap-2.5 rounded-2xl border-2 px-5 text-base font-bold transition-colors',
                destino?.kind === 'geo'
                  ? 'border-pine-700 bg-pine-50 text-pine-800'
                  : 'border-line-strong bg-cream text-ink hover:border-pine-600 hover:text-pine-800',
                'disabled:cursor-wait',
              )}
            >
              {geoA ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <LocateFixed aria-hidden className="size-5" />}
              {geoA ? 'A localizar…' : 'Perto de mim'}
            </button>
          </div>
          {geo.s === 'erro' && (
            <p id={ids.geoErro} role="alert" className="text-sm font-bold text-alert-700">
              {geo.msg}
            </p>
          )}
        </div>

        {/* Tipo */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-x-3 text-base font-bold text-ink">
            <span>Que tipo de resposta?</span>
            <Link to="/guia#tipos" className="link text-sm font-semibold">
              Qual é a diferença?
            </Link>
          </legend>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-sand p-1.5 sm:grid-cols-4">
            {TIPOS.map((t) => (
              <label
                key={t.id}
                className={cn(
                  'relative flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm leading-tight font-bold transition-colors',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                  tipo === t.id ? 'bg-pine-800 text-white shadow-soft' : 'text-ink-soft hover:bg-white/70 hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="tipo-resposta"
                  value={t.id}
                  checked={tipo === t.id}
                  onChange={() => setTipo(t.id)}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Switch
            checked={soVaga}
            onChange={setSoVaga}
            label="Só com vaga agora"
            description="Esconde as instituições em lista de espera"
            className="flex-row-reverse justify-end sm:max-w-xs"
          />
          <Button type="submit" size="lg" icon={<Search aria-hidden className="size-5" />} className="min-h-16 px-9 text-xl sm:min-w-56" aria-describedby={ids.resumo}>
            Ver vagas
          </Button>
        </div>
      </div>

      {/* Resumo em direto */}
      <div
        id={ids.resumo}
        aria-live="polite"
        className="flex min-h-14 items-center gap-3 rounded-b-[1.75rem] border-t border-dashed border-line-strong bg-cream px-4 py-3 text-sm sm:px-6"
      >
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', contagem.comVaga ? 'animate-pulse-ring bg-leaf-500' : 'bg-dusk-500')} />
        {textoLivre ? (
          <p className="text-ink-soft">
            Não reconhecemos «<strong className="text-ink">{textoLivre}</strong>» como localidade. Escolha uma sugestão ou carregue em{' '}
            <strong className="text-ink">Ver vagas</strong> para procurar pelo nome da instituição.
          </p>
        ) : contagem.total === 0 ? (
          <p className="text-ink-soft">
            {onde(efetivo)}: ainda não há instituições deste tipo no EncontraLar. Experimente <strong className="text-ink">Qualquer</strong> ou alargue a zona.
          </p>
        ) : (
          <p className="text-ink-soft">
            {onde(efetivo)}:{' '}
            <strong className="text-ink tabular">{plural(contagem.total, 'instituição', 'instituições')}</strong>,{' '}
            <strong className={cn('tabular', contagem.comVaga ? 'text-leaf-700' : 'text-ink')}>{contagem.comVaga} com vaga agora</strong>.
            {soVaga && semVagaAqui && (
              <>
                {' '}
                <span className="font-semibold text-sun-800">Desligue «Só com vaga agora» para ver quando se prevê vaga.</span>
              </>
            )}
          </p>
        )}
      </div>
    </form>
  )
}
