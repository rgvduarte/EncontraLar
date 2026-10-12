import { useId, useMemo, useState } from 'react'
import { LoaderCircle, LocateFixed, MapPinned } from 'lucide-react'
import { LUGARES } from '@/data/localidades'
import { Button } from '@/components/ui/Button'
import { vagasLivres } from '@/lib/forecast'
import { plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PlaceCombobox } from '../controls/PlaceCombobox'
import { RangeSlider } from '../controls/RangeSlider'
import { ProximityRadar, RadarLegend } from '../controls/ProximityRadar'
import { comDistancia, pontoRadar, residenciais } from '../area'
import { deLocal, LABEL_GPS } from '../language'
import { RAIO_MAX, RAIO_MIN } from '../model'
import type { StepProps } from './types'

const ATALHOS = ['Lisboa', 'Porto', 'Coimbra', 'Braga', 'Faro', 'Funchal']
const MARCAS = [5, 15, 25, 35, 50]

type EstadoGps = { s: 'parado' } | { s: 'a-procurar' } | { s: 'erro'; msg: string }

export function StepLocal({ r, patch, erros, lares }: StepProps) {
  const raioId = useId()
  const [gps, setGps] = useState<EstadoGps>({ s: 'parado' })

  const perto = useMemo(() => (r.local ? comDistancia(residenciais(lares), r.local) : []), [lares, r.local])
  const noRaio = perto.filter((x) => x.d <= r.raioKm)
  const comVaga = noRaio.filter((x) => vagasLivres(x.lar) > 0).length
  const pontos = useMemo(
    () => perto.filter((x) => x.d <= r.raioKm * 1.35).map((x) => pontoRadar(x.lar, { esbatido: x.d > r.raioKm })),
    [perto, r.raioKm],
  )
  const maisProxima = perto[0]

  const usarGps = () => {
    if (!('geolocation' in navigator)) {
      setGps({ s: 'erro', msg: 'Este navegador não permite partilhar a localização. Escreva a localidade.' })
      return
    }
    setGps({ s: 'a-procurar' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ s: 'parado' })
        patch({ local: { label: LABEL_GPS, lat: pos.coords.latitude, lng: pos.coords.longitude } })
      },
      (err) =>
        setGps({
          s: 'erro',
          msg:
            err.code === err.PERMISSION_DENIED
              ? 'Não deu autorização para usar a localização. Pode escrever a localidade acima.'
              : 'Não foi possível obter a localização agora. Escreva a localidade acima.',
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:gap-12">
      <div className="flex min-w-0 flex-col gap-9">
        <div className="flex flex-col gap-4">
          <PlaceCombobox
            key={r.local?.label === LABEL_GPS ? 'gps' : 'lugar'}
            label="Localidade ou concelho"
            hint="A morada de um filho, a casa de sempre, o hospital onde é seguido(a)…"
            value={r.local && r.local.label !== LABEL_GPS ? r.local : null}
            onChange={(local) => {
              if (local) setGps({ s: 'parado' })
              if (local || r.local?.label !== LABEL_GPS) patch({ local })
            }}
            lares={lares}
            error={erros.local}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <Button
              variant={r.local?.label === LABEL_GPS ? 'subtle' : 'secondary'}
              onClick={usarGps}
              disabled={gps.s === 'a-procurar'}
              aria-pressed={r.local?.label === LABEL_GPS}
              icon={
                gps.s === 'a-procurar' ? (
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                ) : (
                  <LocateFixed aria-hidden className="size-5" />
                )
              }
            >
              {gps.s === 'a-procurar' ? 'A procurar…' : r.local?.label === LABEL_GPS ? 'A usar a sua localização' : 'Perto de mim'}
            </Button>
            <span className="text-sm text-ink-mute">ou, mais rápido:</span>
            <ul className="flex flex-wrap gap-2" aria-label="Localidades frequentes">
              {ATALHOS.map((nome) => {
                const l = LUGARES.find((x) => x.label === nome)
                if (!l) return null
                const ativo = r.local?.label === nome
                return (
                  <li key={nome}>
                    <button
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => {
                        setGps({ s: 'parado' })
                        patch({ local: { label: l.label, lat: l.lat, lng: l.lng } })
                      }}
                      className={cn(
                        'min-h-12 rounded-full border-2 px-4 text-sm font-bold transition-colors',
                        ativo ? 'border-pine-700 bg-pine-700 text-white' : 'border-line bg-white text-ink hover:border-pine-500',
                      )}
                    >
                      {nome}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <p aria-live="polite" className={cn('text-sm', gps.s === 'erro' ? 'font-bold text-alert-700' : 'sr-only')}>
            {gps.s === 'erro' ? gps.msg : r.local?.label === LABEL_GPS ? 'Localização obtida.' : ''}
          </p>
        </div>

        <div className={cn('flex flex-col gap-3 transition-opacity', !r.local && 'opacity-55')}>
          <div className="flex items-end justify-between gap-4">
            <label htmlFor={raioId} className="text-lg font-bold text-ink">
              Até que distância?
            </label>
            <p className="font-display text-4xl leading-none font-semibold text-pine-800 tabular" aria-hidden>
              {r.raioKm}
              <span className="ml-1 text-xl text-ink-soft">km</span>
            </p>
          </div>
          <RangeSlider
            id={raioId}
            min={RAIO_MIN}
            max={RAIO_MAX}
            step={5}
            value={r.raioKm}
            onValue={(raioKm) => patch({ raioKm })}
            aria-valuetext={`${r.raioKm} quilómetros`}
            aria-describedby={`${raioId}-conta`}
          />
          <div aria-hidden className="relative -mt-1 h-5 text-sm text-ink-mute tabular">
            {MARCAS.map((m) => (
              <span
                key={m}
                className="absolute -translate-x-1/2"
                style={{ left: `calc(16px + (100% - 32px) * ${(m - RAIO_MIN) / (RAIO_MAX - RAIO_MIN)})` }}
              >
                {m}
              </span>
            ))}
          </div>
          <p id={`${raioId}-conta`} aria-live="polite" className="mt-3 rounded-2xl bg-sand px-5 py-4 text-base text-ink">
            {r.local ? (
              noRaio.length ? (
                <>
                  <strong className="font-display text-2xl font-semibold text-pine-800 tabular">{noRaio.length}</strong>{' '}
                  {noRaio.length === 1 ? 'instituição' : 'instituições'} neste raio
                  {comVaga > 0 ? (
                    <>
                      , <strong className="text-leaf-700">{comVaga} com vaga agora</strong>.
                    </>
                  ) : (
                    '. Nenhuma com vaga hoje — a previsão ajuda a escolher onde se inscrever.'
                  )}
                </>
              ) : maisProxima ? (
                <>
                  Nenhuma instituição a menos de {r.raioKm} km. A mais próxima fica a{' '}
                  <strong>{Math.ceil(maisProxima.d)} km</strong> — experimente alargar o raio.
                </>
              ) : (
                'Ainda não temos instituições registadas perto desta localização.'
              )
            ) : (
              'Escolha primeiro uma localidade para ver quantas instituições ficam por perto.'
            )}
          </p>
        </div>
      </div>

      <figure className="flex flex-col gap-3 self-start rounded-4xl border border-line bg-white p-4 shadow-card xl:sticky xl:top-[calc(4.5rem+1.5rem)]">
        {r.local ? (
          <ProximityRadar
            centro={r.local}
            raioKm={r.raioKm}
            pontos={pontos}
            rotuloCentro={r.local.label}
            titulo={`Mapa de proximidade: ${plural(noRaio.length, 'instituição', 'instituições')} a menos de ${r.raioKm} km ${deLocal(r.local.label)}.`}
          />
        ) : (
          <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl bg-sand/70 p-8 text-center text-ink-soft">
            <MapPinned aria-hidden className="size-10 text-pine-600" />
            <p className="max-w-56 text-sm">O mapa de proximidade aparece quando escolher a localidade.</p>
          </div>
        )}
        <figcaption className="px-2 pb-1">
          <RadarLegend />
        </figcaption>
      </figure>
    </div>
  )
}
