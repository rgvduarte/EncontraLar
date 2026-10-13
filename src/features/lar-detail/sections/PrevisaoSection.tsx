import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { ForecastChart } from '@/components/lar/ForecastChart'
import { BloqueioCartao } from '@/components/acesso'
import { FATOR_LISTA_EFETIVA } from '@/lib/forecast'
import { num, pct, plural } from '@/lib/format'
import { Bloco, Secao, Subtitulo } from '../Secao'
import { GraficoAnimado, PalavrasAcesas, TiraAnimada } from '../motion'
import { caminhoFicha, esperaEstimada, noLar, type DadosLar } from '../helpers'

const SABER_MAIS = 'mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline'

/**
 * O "clímax" da ficha: a frase-chave acende-se palavra a palavra, os meses da tira entram um a um com a
 * barra a encher, e o gráfico de 12 meses desenha-se (barras crescem, linha da probabilidade traça-se).
 * Versão grátis (`completo` falso): o bloqueio padrão e o método em termos gerais — nenhum número da previsão,
 * nem a tira nem o gráfico, chega ao DOM.
 */
export function PrevisaoSection({ lar, dados, completo }: { lar: Lar; dados: DadosLar; completo: boolean }) {
  const { unidade } = dados
  const umaVaga = unidade.um === 'lugar' ? 'um lugar' : 'uma vaga'

  return (
    <Secao
      id="ficha-previsao"
      rotulo="Previsão de vagas"
      titulo={
        <>
          Quando poderá haver <em>{unidade.um}</em>
        </>
      }
      intro={`A probabilidade de lhe ser proposta ${umaVaga} até ao fim de cada mês, se pedir hoje.`}
    >
      {completo ? (
        <PrevisaoCompleta lar={lar} dados={dados} />
      ) : (
        <>
          <Bloco>
            <BloqueioCartao titulo="Previsão de espera para esta casa" voltar={caminhoFicha(lar)} />
          </Bloco>
          <Bloco className="mt-16 max-w-[65ch]">
            <Subtitulo>Como calculamos</Subtitulo>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">
              Partimos das saídas registadas pela instituição nos últimos 12 meses e da estadia média dos residentes, ajustadas à
              época do ano. Da lista de espera contamos só quem, em média, ainda aceita quando é contactado.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-ink">
              É uma estimativa, não é garantia. A decisão de atribuir {umaVaga} é sempre da equipa técnica.
            </p>
            <Link to="/sobre#previsao" className={SABER_MAIS}>
              Saber mais sobre a previsão
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </Bloco>
        </>
      )}
    </Secao>
  )
}

function PrevisaoCompleta({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const { est, previsao, unidade } = dados
  const totalSaidas = lar.historicoSaidas.reduce((a, b) => a + b, 0)

  return (
    <>
      <PalavrasAcesas
        aria-live="polite"
        className="max-w-2xl text-[1.75rem] leading-[1.2] font-semibold tracking-tight text-ink sm:text-4xl sm:leading-[1.15]"
        partes={
          est.imediata
            ? [{ texto: 'Há lugar livre neste momento, sem ninguém à sua frente.' }]
            : [
                { texto: `${pct(est.p90)} em 3\u00a0meses. ${pct(est.p180)} em\u00a06.` },
                { texto: `Espera estimada de ${esperaEstimada(est)}.`, className: 'text-ink-mute' },
              ]
        }
      />

      {!est.imediata && (
        <TiraAnimada className="mt-12">
          <ForecastStrip curva={est.curva} meses={6} />
        </TiraAnimada>
      )}

      <div className="mt-16">
        <Bloco>
          <Subtitulo>Nos próximos 12 meses</Subtitulo>
          <p className="mt-2 mb-6 text-ink-mute">
            {est.imediata
              ? `${unidade.varios[0]!.toUpperCase()}${unidade.varios.slice(1)} que deverão libertar-se em cada mês, além dos que já estão livres.`
              : `Barras: ${unidade.varios} que deverão libertar-se em cada mês. Linha: a sua probabilidade acumulada.`}
          </p>
        </Bloco>
        <GraficoAnimado>
          <ForecastChart
            data={previsao}
            probabilidade={est.imediata ? undefined : est.curva}
            caption={`Previsão de ${unidade.varios} ${noLar(lar.nome)} nos próximos 12 meses`}
          />
        </GraficoAnimado>
      </div>

      <Bloco className="mt-16 max-w-[65ch]">
        <Subtitulo>Como calculamos</Subtitulo>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {lar.historicoSaidas.length
            ? `Partimos das saídas registadas pela instituição nos últimos 12 meses (${num(totalSaidas)}) e da estadia média dos residentes (${plural(lar.estadiaMediaMeses, 'mês', 'meses')}), ajustadas à época do ano.`
            : `Ainda não há histórico de saídas: usamos a estadia média típica (${plural(lar.estadiaMediaMeses, 'mês', 'meses')}) e a ocupação atual, ajustadas à época do ano.`}{' '}
          {lar.listaEspera > 0
            ? `Da lista de espera (${plural(lar.listaEspera, 'pessoa', 'pessoas')}) contamos só quem, em média, ainda aceita quando é contactado (${pct(FATOR_LISTA_EFETIVA)}): cerca de ${num(est.listaEfetiva)} à sua frente.`
            : 'Neste momento não há ninguém na lista de espera.'}
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          É uma estimativa, não é garantia. A decisão de atribuir {unidade.um === 'lugar' ? 'um lugar' : 'uma vaga'} é sempre da equipa técnica.
        </p>
        <Link to="/sobre#previsao" className={SABER_MAIS}>
          Saber mais sobre a previsão
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </Bloco>
    </>
  )
}
