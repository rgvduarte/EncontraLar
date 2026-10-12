import { Link } from 'react-router'
import { ArrowRight, FileText, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { LarCover } from '@/components/lar/LarCover'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { cn } from '@/lib/cn'
import type { PedidoComLar } from '../shared/data'
import { estimativaPessoal, horaDe } from '../shared/estado'
import { PedidoRail } from '../shared/PedidoRail'
import { BlockHeading, EstadoBadge } from '../shared/ui'
import { diaPorExtenso, nomeCurto, ordinal, telHref } from '../shared/text'

/** Faixa inferior de cada pedido: o número que importa para aquele estado. */
function Situacao({ c, lar }: { c: Candidatura; lar: Lar }) {
  if (c.estado === 'aceite') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-50 px-4 py-3">
        <p className="text-sm">
          <strong className="text-leaf-700">Entrada a combinar.</strong> A instituição vai ligar-lhe para marcar o dia.
        </p>
        {lar.telefone && (
          <a href={telHref(lar.telefone)} className="link inline-flex min-h-11 items-center gap-1.5 text-sm">
            <Phone aria-hidden className="size-4" />
            {lar.telefone}
          </a>
        )}
      </div>
    )
  }
  if (c.estado === 'vaga_proposta') {
    return (
      <div className="rounded-2xl bg-terra-50 px-4 py-3 text-sm">
        <strong className="text-terra-800">Tem uma vaga à espera de resposta</strong>
        {c.prazoResposta && (
          <>
            {' '}
            — até {diaPorExtenso(new Date(c.prazoResposta))}, às {horaDe(c.prazoResposta)}.
          </>
        )}{' '}
        <a href="#vaga-proposta" className="link">
          Responder
        </a>
      </div>
    )
  }
  const { est, texto, pessoal } = estimativaPessoal(lar, c.posicao)
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-2xl bg-sand/70 px-4 py-3">
      <dl className="flex flex-wrap gap-x-7 gap-y-2">
        <div>
          <dt className="text-xs font-semibold text-ink-soft">Lugar na lista</dt>
          <dd className="font-display text-2xl leading-tight font-semibold tabular">
            {c.posicao ? (
              <>
                {ordinal(c.posicao)}
                <span className="ml-1 font-sans text-sm font-normal text-ink-soft">de {Math.max(lar.listaEspera, c.posicao)}</span>
              </>
            ) : (
              <span className="font-sans text-base font-semibold text-ink-soft">ainda sem lugar</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-soft">{pessoal ? 'Estimativa para si' : 'Se entrar hoje na lista'}</dt>
          <dd className="text-base leading-tight font-bold first-letter:uppercase">{texto}</dd>
        </div>
      </dl>
      {!est.imediata && <ForecastStrip curva={est.curva} meses={6} variant="mini" />}
    </div>
  )
}

export function PedidosResumo({ ativos, terminados }: { ativos: PedidoComLar[]; terminados: number }) {
  return (
    <section aria-labelledby="resumo-pedidos" className="rounded-[1.75rem] border border-line bg-white shadow-card">
      <div className="px-5 pt-6 pb-2 sm:px-7">
        <BlockHeading
          id="resumo-pedidos"
          kicker="Pedidos de vaga"
          title={ativos.length ? `${ativos.length === 1 ? 'Um pedido' : `${ativos.length} pedidos`} em curso` : 'Nenhum pedido em curso'}
          action={ativos.length ? { to: '/familia/pedidos', label: 'Ver em detalhe' } : undefined}
        />
      </div>

      {ativos.length === 0 ? (
        <div className="px-5 pb-7 sm:px-7">
          <p className="max-w-prose text-ink-soft">
            Pode pedir vaga em várias instituições ao mesmo tempo: as listas de espera andam a ritmos diferentes e um pedido não
            obriga a nada. Se surgir uma vaga, decide nessa altura.
          </p>
          <ButtonLink to="/pesquisa?vaga=breve" className="mt-4" icon={<FileText aria-hidden className="size-5" />}>
            Encontrar instituições com vaga
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {ativos.slice(0, 4).map(({ c, lar }) => (
            <li key={c.id} className="px-5 py-5 sm:px-7">
              <div className="flex items-start gap-4">
                <div aria-hidden className="size-14 shrink-0 overflow-hidden rounded-2xl border border-line">
                  <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h3 className="font-display text-lg leading-snug font-semibold">
                      <Link to={`/familia/pedidos#pedido-${c.id}`} className="hover:underline">
                        {lar.nome}
                      </Link>
                    </h3>
                    <EstadoBadge estado={c.estado} />
                  </div>
                  <p className="text-sm text-ink-soft">
                    {lar.localidade} · para {nomeCurto(c.perfil.nome)}
                  </p>
                </div>
              </div>
              <PedidoRail c={c} className="mt-5" />
              <div className="mt-4">
                <Situacao c={c} lar={lar} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(ativos.length > 4 || terminados > 0) && (
        <p className={cn('border-t border-line px-5 py-4 text-sm text-ink-soft sm:px-7')}>
          {ativos.length > 4 && <>Mais {ativos.length - 4} em curso. </>}
          {terminados > 0 && <>{terminados === 1 ? '1 pedido terminado' : `${terminados} pedidos terminados`} no histórico. </>}
          <Link to="/familia/pedidos" className="link inline-flex items-center gap-1">
            Ver todos
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      )}
    </section>
  )
}
