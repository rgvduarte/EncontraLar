import { Info } from 'lucide-react'
import type { Lar } from '@/types'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { ForecastChart } from '@/components/lar/ForecastChart'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { FATOR_LISTA_EFETIVA } from '@/lib/forecast'
import { num, pct, plural } from '@/lib/format'
import { Secao, Subtitulo } from '../Secao'
import { esperaEstimada, type DadosLar } from '../helpers'
import { ListaEsperaVisual, SaidasBarras } from './PrevisaoGraficos'

export function PrevisaoSection({ lar, dados, numero }: { lar: Lar; dados: DadosLar; numero: number }) {
  const { est, previsao } = dados
  const totalSaidas = lar.historicoSaidas.reduce((a, b) => a + b, 0)

  return (
    <Secao
      id="ficha-previsao"
      numero={numero}
      rotulo="Previsão de vagas"
      titulo={
        <>
          Quando poderá haver <em>vaga</em>
        </>
      }
      intro="Lê-se como a previsão do tempo: a probabilidade de lhe ser proposta uma vaga até ao fim de cada mês, se fizer o pedido hoje."
    >
      <div className="on-dark overflow-hidden rounded-[1.75rem] bg-pine-900 text-white shadow-card" style={calcadaStonesBg('#ffffff', 0.045)}>
        <div className="p-6 sm:p-8">
          <p className="text-sm font-bold tracking-[0.14em] text-sun-200 uppercase">Para quem pedir vaga hoje</p>
          <p className="mt-3 max-w-xl font-display text-3xl leading-tight font-semibold sm:text-4xl" aria-live="polite">
            {est.imediata ? (
              <>
                Há lugar <em>livre</em> neste momento.
              </>
            ) : (
              <>
                <em>{pct(est.p90)}</em> de probabilidade em 3 meses, <em>{pct(est.p180)}</em> em 6.
              </>
            )}
          </p>
          <p className="mt-3 text-pine-200">
            {est.imediata
              ? 'A instituição tem mais lugares livres do que pessoas efetivamente à espera. A vaga é atribuída depois da avaliação da equipa técnica.'
              : `Espera estimada: ${esperaEstimada(est)} (cenário otimista a prudente).`}
          </p>
          <ForecastStrip curva={est.curva} meses={6} className="mt-6 text-ink" />
        </div>
      </div>

      <figure className="mt-8 rounded-3xl border border-line bg-white p-5 sm:p-7">
        <Subtitulo>Vagas que deverão libertar-se, mês a mês</Subtitulo>
        <p className="mt-1 mb-5 text-sm text-ink-soft">
          Barras: lugares que se espera que fiquem livres em cada mês. Linha: a sua probabilidade acumulada de vaga. Passe o cursor ou use o teclado para
          ver os valores.
        </p>
        <ForecastChart data={previsao} probabilidade={est.curva} caption={`Previsão de vagas em ${lar.nome} nos próximos 12 meses`} />
      </figure>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div>
          <Subtitulo>Como calculamos</Subtitulo>
          <ol className="mt-4 space-y-5">
            {[
              {
                t: 'A rotatividade desta casa',
                d: lar.historicoSaidas.length
                  ? `As saídas registadas pela instituição nos últimos 12 meses (${num(totalSaidas)}) e a estadia média dos residentes (${plural(lar.estadiaMediaMeses, 'mês', 'meses')}).`
                  : `Ainda não há histórico de saídas: usamos a estadia média típica (${plural(lar.estadiaMediaMeses, 'mês', 'meses')}) e a ocupação atual.`,
              },
              { t: 'O calendário', d: 'A rotatividade não é igual em todos os meses; ajustamos a previsão à época do ano.' },
              {
                t: 'Quem está à sua frente',
                d: `Só uma parte da lista de espera ainda aceita a vaga quando é contactada (em média ${pct(FATOR_LISTA_EFETIVA)}). Contamos essa lista efetiva.`,
              },
            ].map((p, i) => (
              <li key={p.t} className="flex gap-4">
                <span aria-hidden className="font-display text-4xl leading-none font-semibold text-terra-500 italic">
                  {i + 1}
                </span>
                <span>
                  <strong className="block text-ink">{p.t}</strong>
                  <span className="text-ink-soft">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-8">
          <SaidasBarras historico={lar.historicoSaidas} />
          <ListaEsperaVisual inscritos={lar.listaEspera} efetiva={est.listaEfetiva} />
        </div>
      </div>

      <p className="mt-10 flex gap-3 rounded-2xl border-l-4 border-sun-400 bg-sun-50 px-5 py-4 text-ink">
        <Info aria-hidden className="mt-1 size-5 shrink-0 text-sun-700" />
        <span>
          <strong>É uma estimativa estatística, não é garantia.</strong> Baseia-se nos dados declarados pela instituição e pode mudar de um dia para o
          outro. A decisão de atribuir uma vaga é sempre da equipa técnica, que avalia cada pedido.
        </span>
      </p>
    </Secao>
  )
}
