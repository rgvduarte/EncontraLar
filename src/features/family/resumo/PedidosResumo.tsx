import { Link } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import type { PedidoComLar } from '../shared/data'
import { estimativaPessoal, horaDe } from '../shared/estado'
import { EstadoTag, MoreLink, SectionHeader } from '../shared/ui'
import { nomeCurto, ordinal } from '../shared/text'

/** O número que importa para cada estado, à direita da linha. */
function Situacao({ c, lar }: { c: Candidatura; lar: Lar }) {
  if (c.estado === 'vaga_proposta') {
    return (
      <p className="sm:text-right">
        <span className="block text-sm text-ink-mute">Responder até</span>
        <span className="font-semibold text-terra-700">
          {c.prazoResposta
            ? `${new Date(c.prazoResposta).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' })}, ${horaDe(c.prazoResposta)}`
            : 'o quanto antes'}
        </span>
      </p>
    )
  }
  if (c.estado === 'aceite') {
    return (
      <p className="sm:text-right">
        <span className="block text-sm text-ink-mute">Entrada</span>
        <span className="font-semibold">a combinar</span>
      </p>
    )
  }
  const { est, texto, pessoal } = estimativaPessoal(lar, c.posicao)
  return (
    <div className="flex items-center gap-5">
      <p className="sm:text-right">
        <span className="block text-sm text-ink-mute">{pessoal ? 'Estimativa' : 'Se entrar na lista hoje'}</span>
        <span className="font-semibold">{texto}</span>
      </p>
      {!est.imediata && <ForecastStrip curva={est.curva} meses={6} variant="mini" />}
    </div>
  )
}

/** "Os seus pedidos": linhas compactas — instituição, estado, lugar e estimativa pessoal. */
export function PedidosResumo({ ativos, terminados, pesquisa }: { ativos: PedidoComLar[]; terminados: number; pesquisa: string }) {
  const visiveis = ativos.slice(0, 5)
  return (
    <section aria-labelledby="resumo-pedidos">
      <SectionHeader
        id="resumo-pedidos"
        title="Os seus pedidos"
        action={ativos.length > 0 || terminados > 0 ? <MoreLink to="/familia/pedidos">Ver todos</MoreLink> : undefined}
      />

      {ativos.length === 0 ? (
        <div className="mt-6 border-y border-line py-6">
          <p className="max-w-xl text-ink-soft">
            Ainda sem pedidos em curso. Pode pedir vaga em várias instituições ao mesmo tempo — um pedido não obriga a nada.
          </p>
          <MoreLink to={`${pesquisa}${pesquisa.includes('?') ? '&' : '?'}vaga=breve`} className="mt-2">
            Encontrar instituições com vaga
          </MoreLink>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {visiveis.map(({ c, lar }) => (
            <li key={c.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-6">
              <div aria-hidden className="size-14 overflow-hidden rounded-xl">
                <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg leading-snug font-semibold">
                  <Link to={`/familia/pedidos#pedido-${c.id}`} className="hover:underline">
                    {lar.nome}
                  </Link>
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-mute">
                  <EstadoTag estado={c.estado} className="text-ink-soft" />
                  {c.posicao != null && c.estado === 'lista_espera' && <span>· {ordinal(c.posicao)} lugar</span>}
                  <span>· {nomeCurto(c.perfil.nome)}</span>
                </p>
              </div>
              <div className="col-start-2 sm:col-start-3">
                <Situacao c={c} lar={lar} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(ativos.length > visiveis.length || terminados > 0) && (
        <p className="mt-4 text-sm text-ink-mute">
          {ativos.length > visiveis.length && `Mais ${ativos.length - visiveis.length} em curso. `}
          {terminados > 0 && (terminados === 1 ? '1 pedido terminado.' : `${terminados} pedidos terminados.`)}
        </p>
      )}
    </section>
  )
}
