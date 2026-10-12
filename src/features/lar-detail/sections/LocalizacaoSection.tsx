import { Component, lazy, Suspense, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { Spinner } from '@/components/ui/misc'
import { Secao } from '../Secao'
import { telHref } from '../helpers'

const LocationMap = lazy(() => import('./LocationMap'))

/** Se o mapa falhar (por ex. sem rede), a morada continua a ser a informação principal. */
class MapaSeguro extends Component<{ children: ReactNode; fallback: ReactNode }, { erro: boolean }> {
  state = { erro: false }
  static getDerivedStateFromError() {
    return { erro: true }
  }
  render() {
    return this.state.erro ? this.props.fallback : this.props.children
  }
}

const ligacao = 'inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline'

export function LocalizacaoSection({ lar }: { lar: Lar }) {
  const destino = `https://www.google.com/maps/dir/?api=1&destination=${lar.lat},${lar.lng}`
  const zona = [...new Set([lar.concelho, lar.distrito])].join(', ')

  return (
    <Secao id="ficha-localizacao" rotulo="Localização" titulo="Onde fica">
      <div className="relative h-72 overflow-hidden rounded-[1.75rem] bg-sand sm:h-96 [&_.leaflet-bar]:overflow-hidden [&_.leaflet-bar]:rounded-xl [&_.leaflet-control-attribution]:mr-5 [&_.leaflet-control-attribution]:mb-2 [&_.leaflet-control-attribution]:rounded-full [&_.leaflet-control-attribution]:px-2 [&_.leaflet-control-zoom]:mt-4 [&_.leaflet-control-zoom]:ml-4">
        <MapaSeguro fallback={<p className="flex h-full items-center justify-center p-6 text-center text-ink-mute">Não foi possível carregar o mapa.</p>}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            }
          >
            <LocationMap lat={lar.lat} lng={lar.lng} nome={lar.nome} />
          </Suspense>
        </MapaSeguro>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <address className="not-italic">
          <p className="text-sm text-ink-mute">Morada</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{lar.morada || lar.localidade}</p>
          <p className="text-lg text-ink-soft">
            {lar.codigoPostal} {lar.localidade}
          </p>
          {zona !== lar.localidade && <p className="mt-1 text-sm text-ink-mute">{zona}</p>}
          <a href={destino} target="_blank" rel="noopener noreferrer" className={`${ligacao} mt-2`}>
            Como chegar
            <ChevronRight aria-hidden className="size-5" />
            <span className="sr-only">(abre o Google Maps numa nova janela)</span>
          </a>
        </address>

        {(lar.telefone || lar.email || lar.website) && (
          <div>
            <p className="text-sm text-ink-mute">Contactos</p>
            <ul className="mt-1 flex flex-col">
              {lar.telefone && (
                <li>
                  <a href={telHref(lar.telefone)} className={`${ligacao} tabular`}>
                    {lar.telefone}
                  </a>
                </li>
              )}
              {lar.email && (
                <li>
                  <a href={`mailto:${lar.email}`} className={`${ligacao} [overflow-wrap:anywhere]`}>
                    {lar.email}
                  </a>
                </li>
              )}
              {lar.website && (
                <li>
                  <a href={lar.website} target="_blank" rel="noopener noreferrer" className={ligacao}>
                    Site da instituição
                    <ChevronRight aria-hidden className="size-5" />
                    <span className="sr-only">(abre numa nova janela)</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </Secao>
  )
}
