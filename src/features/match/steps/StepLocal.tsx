import { useId, useMemo, useState } from 'react'
import { Check, LoaderCircle, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { vagasLivres } from '@/lib/forecast'
import { km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { PlaceCombobox } from '../controls/PlaceCombobox'
import { RangeSlider } from '../controls/RangeSlider'
import { comDistancia, residenciais } from '../area'
import { LABEL_GPS } from '../language'
import { RAIO_MAX, RAIO_MIN } from '../model'
import type { StepProps } from './types'

type EstadoGps = { s: 'parado' } | { s: 'a-procurar' } | { s: 'erro'; msg: string }

export function StepLocal({ r, patch, erros, lares }: StepProps) {
  const raioId = useId()
  const [gps, setGps] = useState<EstadoGps>({ s: 'parado' })
  const usaGps = r.local?.label === LABEL_GPS

  const perto = useMemo(() => (r.local ? comDistancia(residenciais(lares), r.local) : []), [lares, r.local])
  const noRaio = perto.filter((x) => x.d <= r.raioKm)
  const comVaga = noRaio.filter((x) => vagasLivres(x.lar) > 0).length
  const maisProxima = perto[0]
  // raio (múltiplo de 5) que já inclui a instituição mais próxima
  const raioSugerido = maisProxima ? Math.min(RAIO_MAX, Math.ceil((maisProxima.d + 0.5) / 5) * 5) : null

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
              ? 'Não deu autorização para usar a localização. Escreva a localidade.'
              : 'Não foi possível obter a localização agora. Escreva a localidade.',
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      <div className="flex flex-col gap-4">
        <PlaceCombobox
          key={usaGps ? 'gps' : 'lugar'}
          label="Localidade ou concelho"
          value={r.local && !usaGps ? r.local : null}
          onChange={(local) => {
            if (local) setGps({ s: 'parado' })
            if (local || !usaGps) patch({ local })
          }}
          lares={lares}
          error={erros.local}
        />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-mute">ou</span>
          <Button
            variant={usaGps ? 'primary' : 'subtle'}
            onClick={usarGps}
            disabled={gps.s === 'a-procurar'}
            aria-pressed={usaGps}
            icon={
              gps.s === 'a-procurar' ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : usaGps ? (
                <Check aria-hidden />
              ) : (
                <LocateFixed aria-hidden />
              )
            }
          >
            {gps.s === 'a-procurar' ? 'A procurar…' : usaGps ? 'A usar a sua localização' : 'Perto de mim'}
          </Button>
        </div>
        <p aria-live="polite" className={cn('text-sm', gps.s === 'erro' ? 'font-medium text-alert-700' : 'sr-only')}>
          {gps.s === 'erro' ? gps.msg : usaGps ? 'A usar a sua localização atual.' : ''}
        </p>
      </div>

      <div className={cn('transition-opacity duration-300', !r.local && 'opacity-40')}>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={raioId} className="text-base font-medium text-ink">
            Até que distância?
          </label>
          <p aria-hidden className="text-3xl font-semibold text-ink tabular">
            {r.raioKm} km
          </p>
        </div>
        <RangeSlider
          id={raioId}
          className="mt-2"
          min={RAIO_MIN}
          max={RAIO_MAX}
          step={5}
          value={r.raioKm}
          onValue={(raioKm) => patch({ raioKm })}
          aria-valuetext={`${r.raioKm} quilómetros`}
          aria-describedby={`${raioId}-conta`}
        />
        <div aria-hidden className="flex justify-between text-sm text-ink-mute tabular">
          <span>{RAIO_MIN} km</span>
          <span>{RAIO_MAX} km</span>
        </div>

        <div id={`${raioId}-conta`} aria-live="polite" className="mt-6 text-center sm:mt-10">
          {!r.local ? (
            <p className="text-base text-ink-mute">Escolha uma localidade para ver quantas instituições ficam por perto.</p>
          ) : noRaio.length ? (
            <>
              <p className="text-ink">
                <span className="block text-5xl font-semibold tracking-tight tabular sm:text-6xl">{noRaio.length}</span>
                <span className="mt-1 block text-lg">{noRaio.length === 1 ? 'instituição neste raio' : 'instituições neste raio'}</span>
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-base text-ink-mute">
                <span aria-hidden className={cn('size-2 rounded-full', comVaga ? 'bg-leaf-500' : 'bg-dusk-500')} />
                {comVaga === 0 ? 'Nenhuma com vaga hoje' : comVaga === 1 ? '1 com vaga agora' : `${comVaga} com vaga agora`}
              </p>
            </>
          ) : maisProxima ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-base text-ink-mute">
                Nenhuma instituição a menos de {r.raioKm} km. A mais próxima fica a {km(maisProxima.d)}.
              </p>
              {raioSugerido != null && raioSugerido > r.raioKm && (
                <Button variant="subtle" onClick={() => patch({ raioKm: raioSugerido })}>
                  Alargar para {raioSugerido} km
                </Button>
              )}
            </div>
          ) : (
            <p className="text-base text-ink-mute">Ainda não temos instituições registadas perto deste local.</p>
          )}
        </div>
      </div>
    </div>
  )
}
