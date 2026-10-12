import { Link } from 'react-router'
import { ArrowRight, Cloud, CloudSun, Sun } from 'lucide-react'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { azulejoBg } from '@/components/brand/patterns'
import { VerifiedBadge } from '@/components/lar/badges'
import { FATOR_LISTA_EFETIVA } from '@/lib/forecast'
import { dataLonga, duracaoHumana, intervaloMeses, MESES_LONGOS, pct } from '@/lib/format'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import type { PrevisaoDestaque } from './homeData'

/** Artigo definido para o nome de uma instituição ("o Lar…", "a Casa…", "as Residências…"). */
export function artigo(nome: string): string {
  if (/^Residências\b/.test(nome)) return 'as'
  if (/^(Casa|Residência|Quinta)\b/.test(nome)) return 'a'
  return 'o'
}

const decimal = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: v < 10 ? 1 : 0 })

function ceu(p: number) {
  if (p >= 0.66) return { Icon: Sun, txt: 'provável', cor: 'text-leaf-700', fundo: 'from-sun-100 via-sun-50' }
  if (p >= 0.33) return { Icon: CloudSun, txt: 'possível', cor: 'text-sun-800', fundo: 'from-sun-50 via-cream' }
  return { Icon: Cloud, txt: 'pouco provável', cor: 'text-dusk-700', fundo: 'from-dusk-50 via-cream' }
}

/** "Quando vai haver vaga?" — a previsão lida como a previsão do tempo, com um caso real. */
export function ForecastSection({ previsao, agora }: { previsao: PrevisaoDestaque | null; agora: number }) {
  if (!previsao) return null
  const { lar, est } = previsao
  const hoje = new Date(agora)
  const p3 = est.curva[2] ?? est.p90
  const mes3 = MESES_LONGOS[(hoje.getMonth() + 2) % 12]!
  const c = ceu(p3)
  const Art = artigo(lar.nome)

  return (
    <section aria-labelledby="previsao-titulo" className="py-16 lg:py-24">
      <div className="container-page grid grid-cols-1 gap-y-10 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-8">
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:pt-6">
          <p className="eyebrow">Previsão de vagas</p>
          <h2 id="previsao-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
            Quando vai haver <em>vaga?</em>
          </h2>
          <p className="mt-6 font-display text-2xl leading-snug text-ink">
            Lemos as listas de espera como se lê o tempo: sol quando a vaga é provável, nuvens quando ainda não é.
          </p>
        </div>

        {/* Boletim */}
        <figure className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-lift">
            <div className={cn('relative overflow-hidden bg-gradient-to-br to-white px-5 pt-5 pb-7 sm:px-8 sm:pt-7', c.fundo)}>
              <c.Icon aria-hidden strokeWidth={1} className={cn('pointer-events-none absolute -top-16 -right-16 size-48 opacity-[0.14] sm:-top-20 sm:-right-20 sm:size-72', c.cor)} />
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3">
                <p className="text-xs font-bold tracking-[0.16em] text-ink-soft uppercase">Boletim de vagas · {dataLonga(hoje.toISOString())}</p>
                <VerifiedBadge lar={lar} />
              </div>
              <div className="relative mt-5">
                <h3 className="text-2xl leading-tight font-semibold sm:text-3xl">
                  <Link to={`/lar/${lar.id}`} className="decoration-terra-400 decoration-2 underline-offset-4 hover:underline">
                    {lar.nome}
                  </Link>
                </h3>
                <p className="mt-1 text-ink-soft">
                  {lar.localidade === lar.distrito ? lar.localidade : `${lar.localidade}, ${lar.distrito}`} · {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]}
                </p>
              </div>

              <div className="relative mt-6 flex flex-wrap items-end gap-x-6 gap-y-3">
                <p className={cn('font-display text-7xl leading-none font-semibold tracking-tight tabular sm:text-8xl', c.cor)}>{pct(p3)}</p>
                <p className="max-w-56 pb-2 text-lg leading-snug text-ink">
                  de probabilidade de vaga até ao fim de <strong>{mes3}</strong> — <span className={c.cor}>{c.txt}</span>.
                </p>
              </div>
            </div>

            <div className="border-t border-line px-5 py-6 sm:px-8">
              <ForecastStrip curva={est.curva} meses={6} inicio={hoje} />
              <p className="mt-3 text-sm text-ink-mute">Probabilidade acumulada de vaga até ao fim de cada mês, para quem se inscreve hoje.</p>
            </div>

            <dl className="grid border-t border-dashed border-line-strong sm:grid-cols-3" style={azulejoBg('#1d564e', 0.06, 40)}>
              <div className="flex flex-col gap-1 border-b border-line px-5 py-4 sm:border-r sm:border-b-0 sm:px-8">
                <dt className="text-sm text-ink-soft">Hoje</dt>
                <dd className="font-bold text-ink">Sem lugar livre</dd>
              </div>
              <div className="flex flex-col gap-1 border-b border-line px-5 py-4 sm:border-r sm:border-b-0 sm:px-6">
                <dt className="text-sm text-ink-soft">Estimativa central</dt>
                <dd className="font-bold text-ink">{est.diasMediana != null ? duracaoHumana(est.diasMediana) : 'mais de 2 anos'}</dd>
              </div>
              <div className="flex flex-col gap-1 px-5 py-4 sm:px-6">
                <dt className="text-sm text-ink-soft">Intervalo provável</dt>
                <dd className="font-bold text-ink">
                  {est.diasOtimista != null && est.diasPessimista != null ? intervaloMeses(est.diasOtimista, est.diasPessimista) : 'incerto'}
                </dd>
              </div>
            </dl>
          </div>
          <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span>Calculada hoje com os dados desta ficha. É uma estimativa estatística, não uma garantia.</span>
            <Link to={`/lar/${lar.id}`} className="link">
              Abrir a ficha completa
            </Link>
          </figcaption>
        </figure>

        <div className="flex flex-col lg:col-span-5 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-col gap-4 text-lg text-ink-soft">
            <p>
              Hoje, {Art} {lar.nome} não tem lugar livre e tem {lar.listaEspera} pessoas inscritas — mas muitas famílias inscrevem-se
              em vários lares ou já encontraram solução, por isso contamos com cerca de {est.listaEfetiva === 1 ? '1 pessoa' : `${est.listaEfetiva} pessoas`} à frente
              de quem se inscreve agora (lista de espera efetiva, {pct(FATOR_LISTA_EFETIVA)} da lista).
            </p>
            <p>
              Juntamos a rotatividade dos últimos 12 meses (cerca de {decimal(est.taxaMensal)} saídas por mês) e a época do ano — no
              inverno há mais movimento — e calculamos, mês a mês, a probabilidade de a vaga chegar.
            </p>
          </div>
          <Link to="/sobre#previsao" className="link group mt-8 inline-flex min-h-12 items-center gap-2 self-start text-lg">
            Como calculamos a previsão
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}
