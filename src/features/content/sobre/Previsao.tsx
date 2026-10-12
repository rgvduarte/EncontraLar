/**
 * #previsao — como calculamos a previsão de vagas, em linguagem simples, com um exemplo real do store.
 */
import { useMemo, type ReactNode } from 'react'
import type { Lar } from '@/types'
import { estimarEspera, FATOR_LISTA_EFETIVA, ocupados, SAZONALIDADE, taxaSaidasMensal, vagasLivres } from '@/lib/forecast'
import { duracaoHumana, MESES_LONGOS, num, pct } from '@/lib/format'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { CountUp, Reveal, ScrollZoom } from '@/components/motion'
import { useInView } from '@/lib/motion'

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

/** Número que conta ao aparecer (inteiro ou com casas decimais). */
function N({ v, casas = 0, className }: { v: number; casas?: number; className?: string }) {
  return <CountUp value={v} duration={1200} format={casas ? (x) => dec(x, casas) : (x) => num(Math.round(x))} className={className} />
}

/**
 * "Desenha" a faixa de previsão quando entra no ecrã: as colunas sobem em cascata e as barras enchem
 * da esquerda para a direita (só transform/opacity). Aplicado por fora ao ForecastStrip partilhado.
 */
const DESENHO = `
.el-desenho > ol > li { opacity: 0; transform: translateY(14px); transition: opacity .8s cubic-bezier(.16,1,.3,1), transform .8s cubic-bezier(.16,1,.3,1); }
.el-desenho > ol > li > span:nth-child(3) > span { transform: scaleX(0); transform-origin: left; transition: transform 1.1s cubic-bezier(.16,1,.3,1); }
.el-desenho[data-visivel] > ol > li { opacity: 1; transform: none; }
.el-desenho[data-visivel] > ol > li > span:nth-child(3) > span { transform: none; }
${[1, 2, 3, 4, 5, 6].map((i) => `.el-desenho > ol > li:nth-child(${i}), .el-desenho > ol > li:nth-child(${i}) > span:nth-child(3) > span { transition-delay: ${(i - 1) * 110}ms; }`).join('\n')}
@media (prefers-reduced-motion: reduce) {
  .el-desenho > ol > li, .el-desenho > ol > li > span:nth-child(3) > span { opacity: 1; transform: none; transition: none; }
}
@media print { .el-desenho > ol > li, .el-desenho > ol > li > span:nth-child(3) > span { opacity: 1 !important; transform: none !important; } }`

function FaixaDesenhada({ curva }: { curva: number[] }) {
  const [ref, visivel] = useInView<HTMLDivElement>({ threshold: 0.35 })
  return (
    <div ref={ref} className="el-desenho mt-8" data-visivel={visivel ? '' : undefined}>
      <style>{DESENHO}</style>
      <ForecastStrip curva={curva} meses={6} />
    </div>
  )
}

function Exemplo({ lar }: { lar: Lar }) {
  const est = useMemo(() => estimarEspera(lar), [lar])
  const hist = lar.historicoSaidas
  const somaHist = hist.reduce((a, b) => a + b, 0)
  const ocup = ocupados(lar)
  const livres = vagasLivres(lar)
  const estadia = Math.max(6, lar.estadiaMediaMeses) // o mesmo mínimo usado no cálculo
  const linhas: [string, ReactNode][] = [
    [
      'Lugares ocupados',
      <>
        <N v={ocup} /> de {num(lar.capacidade)}
      </>,
    ],
    [
      'Estadia média dos residentes',
      <>
        <N v={lar.estadiaMediaMeses} /> meses
      </>,
    ],
    [
      'Saídas nos últimos 12 meses',
      hist.length ? (
        <>
          <N v={somaHist} /> (média de <N v={somaHist / hist.length} casas={1} /> por mês)
        </>
      ) : (
        'sem registo'
      ),
    ],
    [
      'Ocupados ÷ estadia média',
      <>
        {num(ocup)} ÷ {num(estadia)} = <N v={ocup / estadia} casas={1} />
      </>,
    ],
    [
      'Saídas esperadas por mês',
      <>
        ≈ <N v={taxaSaidasMensal(lar)} casas={1} />
      </>,
    ],
    [
      'Lista de espera',
      <>
        <N v={lar.listaEspera} /> pessoas, contam <N v={est.listaEfetiva} />
      </>,
    ],
    [
      'Lugares livres hoje',
      livres > 0 && !est.imediata ? (
        <>
          <N v={livres} />, para quem já está na lista
        </>
      ) : (
        <N v={livres} />
      ),
    ],
  ]

  return (
    <ScrollZoom from={0.92} radiusFrom={48} radiusTo={28} className="mt-12 bg-sand">
      <figure className="p-6 sm:p-10">
        <figcaption className="text-sm text-ink-mute">Exemplo com dados do protótipo</figcaption>
        <p className="mt-1 text-2xl font-semibold text-ink">{lar.nome}</p>
        <dl className="mt-6 flex flex-col border-t border-line-strong/70 text-base">
          {linhas.map(([k, v], i) => (
            <Reveal
              key={k}
              variant="fade"
              delay={i * 70}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-line-strong/70 py-3 print:!opacity-100"
            >
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-medium text-ink tabular">{v}</dd>
            </Reveal>
          ))}
        </dl>
        <div className="mt-8">
          {est.imediata ? (
            <p className="text-xl font-semibold text-ink">Há lugar livre para quem pede hoje: a vaga é imediata.</p>
          ) : (
            <>
              <p className="text-lg text-ink-soft">
                Um novo pedido precisa de <N v={est.vagasNecessarias} className="font-semibold text-ink tabular" /> saídas. Probabilidade de vaga em 3
                meses: <CountUp value={est.p90} format={pct} className="font-semibold text-ink tabular" />.
              </p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {est.diasMediana == null ? 'Espera prevista superior a 2 anos.' : `Espera estimada: ${duracaoHumana(est.diasMediana)}.`}
              </p>
            </>
          )}
          <FaixaDesenhada curva={est.curva} />
        </div>
      </figure>
    </ScrollZoom>
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
      <div className="container-narrow py-20 sm:py-32 lg:py-40">
        <Reveal variant="blur">
          <h2 id="previsao-titulo" className="headline max-w-[18ch]">
            Como calculamos a previsão de vagas.
          </h2>
          <p className="mt-5 max-w-[46ch] text-xl text-ink-mute sm:text-2xl">Uma estimativa honesta, em três passos. Sem caixas negras.</p>
        </Reveal>

        <ol className="mt-12 flex flex-col border-b border-line sm:mt-14">
          {passos.map((p, i) => (
            <Reveal as="li" key={p.t} delay={i * 100} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 border-t border-line py-7 sm:grid-cols-[3rem_minmax(0,1fr)]">
              <span aria-hidden className="text-xl font-semibold text-ink-mute tabular">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-ink sm:text-2xl">{p.t}</h3>
                <p className="mt-2 max-w-[62ch] text-lg leading-relaxed text-ink-soft">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal as="p" variant="fade" className="mt-10 max-w-[62ch] text-lg leading-relaxed text-ink-soft">
          Com estes números, tratamos as saídas como acontecimentos ao acaso, a um ritmo conhecido: o modelo de Poisson, clássico nas filas de espera.
          Daí sai a probabilidade de haver as saídas necessárias até ao fim de cada mês, que mostramos como «provável», «possível» ou «pouco
          provável».
        </Reveal>

        <Exemplo lar={lar} />

        <Reveal variant="fade">
          <h3 className="mt-16 text-2xl font-semibold text-ink">O que a previsão não sabe.</h3>
          <ul className="mt-5 flex flex-col gap-3 text-lg leading-relaxed text-ink-soft">
            <li>É uma estimativa, nunca uma promessa. Mostramos sempre a incerteza.</li>
            <li>Depende dos dados que cada instituição regista. Com pouco histórico, a margem de erro é maior.</li>
            <li>Não conhece casos concretos: alguém pode desistir, ou a vaga pode abrir num tipo de quarto que não serve.</li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
