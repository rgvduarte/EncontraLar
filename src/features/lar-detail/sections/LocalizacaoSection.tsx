import { Component, lazy, Suspense, useRef, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { Spinner } from '@/components/ui/misc'
import { Reveal } from '@/components/motion'
import { AvisoAcesso } from '@/components/acesso'
import { CENTRO_DISTRITO, LUGARES } from '@/data/localidades'
import { Secao } from '../Secao'
import { Cascata } from '../motion'
import { caminhoFicha, telHref } from '../helpers'
import { useJaPerto } from '../hooks'

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

/**
 * Versão grátis: o mapa mostra só a zona — centrado no concelho (o centro dos lugares desse concelho) ou, sem ele,
 * no distrito — e nunca nas coordenadas da instituição. Null se não houver nenhum dos dois.
 */
function centroDaZona(lar: Lar): { lat: number; lng: number; zoom: number } | null {
  const concelho = LUGARES.find((l) => l.label === lar.concelho)
  if (concelho) return { lat: concelho.lat, lng: concelho.lng, zoom: 12 }
  return CENTRO_DISTRITO[lar.distrito] ?? null
}

/**
 * Onde fica. Versão grátis (`completo` falso): a zona (localidade e concelho) e um mapa da área sem alfinete; a morada,
 * o código postal, "Como chegar" e os contactos (telefone, email, site) são do Acesso Família e não vão para o DOM.
 */
export function LocalizacaoSection({ lar, completo }: { lar: Lar; completo: boolean }) {
  const destino = `https://www.google.com/maps/dir/?api=1&destination=${lar.lat},${lar.lng}`
  const zona = [...new Set([lar.concelho, lar.distrito])].join(', ')
  const area = completo ? null : centroDaZona(lar)
  // o mapa (Leaflet + mosaicos) só se carrega quando a secção está a ~1 ecrã de distância: fica no fim da ficha
  const caixa = useRef<HTMLDivElement>(null)
  const perto = useJaPerto(caixa)
  const aCarregar = (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
  const mapa = completo ? (
    <LocationMap lat={lar.lat} lng={lar.lng} nome={lar.nome} />
  ) : area ? (
    <LocationMap lat={area.lat} lng={area.lng} zoom={area.zoom} nome={lar.nome} marcador={false} rotulo={`Mapa da zona: ${zona}. Sem a localização exata.`} />
  ) : null

  return (
    <Secao id="ficha-localizacao" rotulo="Localização" titulo="Onde fica">
      {mapa && (
        <Reveal variant="scale" duration={1100}>
          <div
            ref={caixa}
            className="relative h-72 overflow-hidden rounded-[1.75rem] bg-sand sm:h-96 [&_.leaflet-bar]:overflow-hidden [&_.leaflet-bar]:rounded-xl! [&_.leaflet-bar]:border-0! [&_.leaflet-control-attribution]:mr-5! [&_.leaflet-control-attribution]:mb-2! [&_.leaflet-control-attribution]:rounded-full [&_.leaflet-control-attribution]:px-2! [&_.leaflet-control-zoom]:mt-4! [&_.leaflet-control-zoom]:ml-4!"
          >
            {perto ? (
              <MapaSeguro
                fallback={<p className="flex h-full items-center justify-center p-6 text-center text-ink-mute">Não foi possível carregar o mapa.</p>}
              >
                <Suspense fallback={aCarregar}>{mapa}</Suspense>
              </MapaSeguro>
            ) : (
              aCarregar
            )}
            {/* versão grátis: diz que é a zona (sem alfinete), para o mapa não parecer incompleto; o nome do mapa já o diz */}
            {!completo && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-4 right-4 z-10 rounded-full bg-white/90 px-3.5 py-1.5 text-sm font-medium text-ink shadow-soft ring-1 ring-black/5 backdrop-blur-md"
              >
                Zona aproximada
              </span>
            )}
          </div>
        </Reveal>
      )}

      {completo ? (
        <Cascata as="div" passo={120} className="mt-10 grid gap-10 sm:grid-cols-2">
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
        </Cascata>
      ) : (
        // versão grátis: só a zona (localidade e concelho); a morada e os contactos vêm com o Acesso Família
        <Cascata as="div" passo={120} className={mapa ? 'mt-10' : undefined}>
          <div>
            <p className="text-sm text-ink-mute">Zona</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{lar.localidade}</p>
            {zona !== lar.localidade && <p className="text-lg text-ink-soft">{zona}</p>}
          </div>
          <AvisoAcesso texto="Contactos com o Acesso Família" voltar={caminhoFicha(lar)} className="mt-4" />
        </Cascata>
      )}
    </Secao>
  )
}
