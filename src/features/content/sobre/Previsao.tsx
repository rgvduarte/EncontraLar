/**
 * #previsao — como calculamos a previsão de vagas, em linguagem simples, com um exemplo real do store.
 */
import { useMemo } from 'react'
import type { Lar } from '@/types'
import { estimarEspera, FATOR_LISTA_EFETIVA, ocupados, SAZONALIDADE, taxaSaidasMensal, vagasLivres } from '@/lib/forecast'
import { duracaoHumana, MESES_LONGOS, num, pct } from '@/lib/format'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { Reveal } from '@/components/ui/Reveal'

const dec = (v: number, casas = 1) => v.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas })

function sazonalidadeExtremos() {
  let max = 0
  let min = 0
  SAZONALIDADE.forEach((v, i) => {
    if (v > SAZONALIDADE[max]!) max = i
    if (v < SAZONALIDADE[min]!) min = i
  })
  return { max, min }
}

function Exemplo({ lar }: { lar: Lar }) {
  const est = useMemo(() => estimarEspera(lar), [lar])
  const hist = lar.historicoSaidas
  const somaHist = hist.reduce((a, b) => a + b, 0)
  const ocup = ocupados(lar)
  const livres = vagasLivres(lar)
  const estadia = Math.max(6, lar.estadiaMediaMeses) // o mesmo mínimo usado no cálculo
  const linhas: [string, string][] = [
    ['Lugares ocupados', `${num(ocup)} de ${num(lar.capacidade)}`],
    ['Estadia média dos residentes', `${num(lar.estadiaMediaMeses)} meses`],
    ['Saídas nos últimos 12 meses', hist.length ? `${num(somaHist)} (média de ${dec(somaHist / hist.length)} por mês)` : 'sem registo'],
    ['Ocupados ÷ estadia média', `${num(ocup)} ÷ ${num(estadia)} = ${dec(ocup / estadia)}`],
    ['Saídas esperadas por mês', `≈ ${dec(taxaSaidasMensal(lar))}`],
    ['Lista de espera', `${num(lar.listaEspera)} pessoas, contam ${num(est.listaEfetiva)}`],
    ['Lugares livres hoje', livres > 0 && !est.imediata ? `${num(livres)}, para quem já está na lista` : num(livres)],
  ]

  return (
    <figure className="mt-12 rounded-[1.75rem] bg-sand p-6 sm:p-10">
      <figcaption className="text-sm text-ink-mute">Exemplo com dados do protótipo</figcaption>
      <p className="mt-1 text-2xl font-semibold text-ink">{lar.nome}</p>
      <dl className="mt-6 flex flex-col border-t border-line-strong/70 text-base">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-line-strong/70 py-3">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="font-medium text-ink tabular">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        {est.imediata ? (
          <p className="text-xl font-semibold text-ink">Há lugar livre para quem pede hoje: a vaga é imediata.</p>
        ) : (
          <>
            <p className="text-lg text-ink-soft">
              Um novo pedido precisa de <span className="font-semibold text-ink tabular">{num(est.vagasNecessarias)}</span> saídas. Probabilidade de
              vaga em 3 meses: <span className="font-semibold text-ink tabular">{pct(est.p90)}</span>.
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {est.diasMediana == null ? 'Espera prevista superior a 2 anos.' : `Vaga provável em ${duracaoHumana(est.diasMediana)}.`}
            </p>
          </>
        )}
        <ForecastStrip curva={est.curva} meses={6} className="mt-8" />
      </div>
    </figure>
  )
}

export function Previsao({ lar }: { lar: Lar }) {
  const { max, min } = sazonalidadeExtremos()
  const passos = [
    {
      t: 'Quantas saídas por mês.',
      d: 'Juntamos dois números com o mesmo peso: a média de saídas que a instituição registou nos últimos 12 meses, e os lugares ocupados a dividir pela estadia média dos residentes.',
    },
    {
      t: 'A altura do ano.',
      d: `Há mais rotatividade no inverno do que no verão. Ajustamos cada mês: em ${MESES_LONGOS[max]} contamos ×${dec(SAZONALIDADE[max]!, 2)}, em ${MESES_LONGOS[min]} ×${dec(SAZONALIDADE[min]!, 2)}.`,
    },
    {
      t: 'Quem está à sua frente.',
      d: `Nem todos os inscritos aceitam a vaga quando chega a sua vez: muitas famílias estão em várias listas ou já encontraram solução. Por isso contamos ${pct(FATOR_LISTA_EFETIVA)} da lista de espera.`,
    },
  ]

  return (
    <section id="previsao" aria-labelledby="previsao-titulo" tabIndex={-1} className="scroll-mt-24 bg-white outline-none">
      <div className="container-narrow py-24 sm:py-32 lg:py-40">
        <Reveal>
          <h2 id="previsao-titulo" className="headline max-w-[18ch]">
            Como calculamos a previsão de vagas.
          </h2>
          <p className="mt-5 max-w-[46ch] text-xl text-ink-mute sm:text-2xl">Uma estimativa honesta, em três passos. Sem caixas negras.</p>
        </Reveal>

        <ol className="mt-14 flex flex-col border-b border-line">
          {passos.map((p, i) => (
            <li key={p.t} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 border-t border-line py-7 sm:grid-cols-[3rem_minmax(0,1fr)]">
              <span aria-hidden className="text-xl font-semibold text-ink-mute tabular">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-ink sm:text-2xl">{p.t}</h3>
                <p className="mt-2 max-w-[62ch] text-lg leading-relaxed text-ink-soft">{p.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[62ch] text-lg leading-relaxed text-ink-soft">
          Com estes números, tratamos as saídas como acontecimentos ao acaso, a um ritmo conhecido: o modelo de Poisson, clássico nas filas de espera.
          Daí sai a probabilidade de haver as saídas necessárias até ao fim de cada mês, que mostramos como «provável», «possível» ou «pouco
          provável».
        </p>

        <Exemplo lar={lar} />

        <h3 className="mt-16 text-2xl font-semibold text-ink">O que a previsão não sabe.</h3>
        <ul className="mt-5 flex flex-col gap-3 text-lg leading-relaxed text-ink-soft">
          <li>É uma estimativa, nunca uma promessa. Mostramos sempre a incerteza.</li>
          <li>Depende dos dados que cada instituição regista. Com pouco histórico, a margem de erro é maior.</li>
          <li>Não conhece casos concretos: alguém pode desistir, ou a vaga pode abrir num tipo de quarto que não serve.</li>
        </ul>
      </div>
    </section>
  )
}
