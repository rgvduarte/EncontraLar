import { Component, lazy, Suspense, type ReactNode } from 'react'
import { ExternalLink, Globe, Mail, MapPin, Navigation, Phone } from 'lucide-react'
import type { Lar } from '@/types'
import { buttonClasses } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/misc'
import { azulejoBg } from '@/components/brand/patterns'
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

export function LocalizacaoSection({ lar, numero }: { lar: Lar; numero: number }) {
  const destino = `https://www.google.com/maps/dir/?api=1&destination=${lar.lat},${lar.lng}`
  const semMapa = (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-ink-soft">
      <MapPin aria-hidden className="size-8 text-pine-700" />
      <p>Não foi possível carregar o mapa. A morada está ao lado.</p>
    </div>
  )

  return (
    <Secao
      id="ficha-localizacao"
      numero={numero}
      rotulo="Localização"
      titulo={
        <>
          Onde <em>fica</em>
        </>
      }
    >
      <div className="grid overflow-hidden rounded-3xl border border-line bg-white md:grid-cols-[1fr_19rem]">
        <div className="relative h-72 bg-pine-50 sm:h-80 md:h-auto md:min-h-96">
          <MapaSeguro fallback={semMapa}>
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
        <div className="flex flex-col border-t border-line md:border-t-0 md:border-l">
          <div aria-hidden className="h-3 opacity-30" style={azulejoBg('#b9472f', 1, 24)} />
          <div className="flex flex-1 flex-col gap-5 p-6">
            <address className="not-italic">
              <p className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Morada</p>
              <p className="mt-1 font-display text-xl leading-snug font-semibold text-ink">{lar.morada || lar.localidade}</p>
              <p className="text-ink-soft">
                {lar.codigoPostal} {lar.localidade}
              </p>
              <p className="mt-1 text-sm text-ink-mute">
                Concelho: {lar.concelho} · {lar.distrito === 'Açores' || lar.distrito === 'Madeira' ? 'Região' : 'Distrito'}: {lar.distrito}
              </p>
            </address>
            <a href={destino} target="_blank" rel="noopener noreferrer" className={buttonClasses('primary', 'md', 'w-full')}>
              <Navigation aria-hidden className="size-5" />
              Como chegar
              <ExternalLink aria-hidden className="size-4 opacity-80" />
              <span className="sr-only">(abre o Google Maps numa nova janela)</span>
            </a>
            <ul className="mt-auto flex flex-col gap-1 border-t border-dashed border-line-strong pt-4">
              {lar.telefone && (
                <li>
                  <a href={telHref(lar.telefone)} className="flex min-h-11 items-center gap-3 font-semibold text-pine-800 hover:underline">
                    <Phone aria-hidden className="size-5" /> <span className="tabular">{lar.telefone}</span>
                  </a>
                </li>
              )}
              {lar.email && (
                <li>
                  <a href={`mailto:${lar.email}`} className="flex min-h-11 items-center gap-3 text-sm font-semibold text-pine-800 hover:underline">
                    <Mail aria-hidden className="size-5 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {lar.email.split(/(?=[@.])/).map((parte, i) => (
                        <span key={i}>
                          {i > 0 && <wbr />}
                          {parte}
                        </span>
                      ))}
                    </span>
                  </a>
                </li>
              )}
              {lar.website && (
                <li>
                  <a href={lar.website} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 font-semibold text-pine-800 hover:underline">
                    <Globe aria-hidden className="size-5" /> Site da instituição
                    <span className="sr-only">(abre numa nova janela)</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Secao>
  )
}
