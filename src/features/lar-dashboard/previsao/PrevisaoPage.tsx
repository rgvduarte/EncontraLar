import { useMemo } from 'react'
import type { Lar } from '@/types'
import { ForecastChart } from '@/components/lar/ForecastChart'
import { Reveal } from '@/components/motion'
import { FATOR_LISTA_EFETIVA, previsaoMensal } from '@/lib/forecast'
import { MESES_LONGOS } from '@/lib/format'
import { insightsPrevisao, type NumerosResumo } from '../lib/derive'
import { MoreLink, SectionTitle, Stat, dec1 } from '../shared/ui'
import { EstadiaForm } from './EstadiaForm'
import { SaidasChart } from './SaidasChart'

/** "Contacte já as N primeiras famílias da lista" — a frase que transforma a previsão numa ação. */
function Conselho({ contactar, listaTotal, listaOnline }: { contactar: number; listaTotal: number; listaOnline: number }) {
  if (listaTotal === 0) {
    return <>A lista de espera está vazia: as vagas que se libertarem aparecem logo como livres no mapa.</>
  }
  const quem = contactar >= listaTotal ? (listaTotal === 1 ? 'a família da lista' : `todas as ${listaTotal} famílias da lista`) : contactar === 1 ? 'a primeira família da lista' : `as ${contactar} primeiras famílias da lista`
  return (
    <>
      Contacte já {quem} para confirmar o interesse.{' '}
      <span className="text-ink-mute">
        Em média, só {Math.round(FATOR_LISTA_EFETIVA * 10)} em cada 10 pessoas inscritas ainda aceitam a vaga quando são contactadas
        {listaOnline > 0 ? '; as inscritas pela plataforma são avisadas automaticamente.' : '.'}
      </span>
    </>
  )
}

/** /gestao/previsao — o que deve libertar-se, com base no histórico, e o que fazer já. */
export default function PrevisaoPage({ lar, n }: { lar: Lar; n: NumerosResumo }) {
  const meses = useMemo(() => previsaoMensal(lar, 12), [lar])
  const ins = useMemo(() => insightsPrevisao(lar, n.listaTotal), [lar, n.listaTotal])
  const hist = lar.historicoSaidas.slice(-12)
  const totalSaidas = hist.reduce((s, v) => s + v, 0)
  const fim3 = meses[2]
  const fim6 = meses[5]

  return (
    <div className="flex flex-col gap-20">
      <section aria-labelledby="prev-resumo">
        <h2 id="prev-resumo" className="sr-only">
          Em resumo
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-10">
          <Stat
            hero
            label={`Até ao fim de ${fim3 ? MESES_LONGOS[fim3.mes] : 'três meses'}`}
            value={dec1(ins.e3)}
            note={`lugares deverão libertar-se · entre ${ins.min3} e ${ins.max3}`}
          />
          <Stat
            delay={80}
            label={`Até ao fim de ${fim6 ? MESES_LONGOS[fim6.mes] : 'seis meses'}`}
            value={dec1(ins.e6)}
            note={`lugares · entre ${ins.min6} e ${ins.max6}`}
          />
        </dl>
        <Reveal delay={160}>
          <p className="mt-12 max-w-2xl text-xl leading-snug font-medium text-ink sm:text-2xl">
            <Conselho contactar={ins.contactar} listaTotal={n.listaTotal} listaOnline={n.listaOnline} />
          </p>
          {n.listaTotal > 0 && (
            <MoreLink to="/gestao/pedidos?filtro=lista" className="mt-3">
              Abrir a lista de espera
            </MoreLink>
          )}
        </Reveal>
      </section>

      <Reveal>
        <section aria-labelledby="prev-meses">
        <SectionTitle id="prev-meses" title="Mês a mês" text="Lugares que deverão libertar-se nos próximos 12 meses, com o intervalo provável." />
        <div className="mt-8">
          <ForecastChart data={meses} caption="Lugares que deverão libertar-se por mês, nos próximos 12 meses" />
        </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="prev-historico">
        <SectionTitle
          id="prev-historico"
          title="Saídas nos últimos 12 meses"
          text={
            hist.length
              ? `${totalSaidas} ${totalSaidas === 1 ? 'saída' : 'saídas'} · em média ${dec1(totalSaidas / hist.length)} por mês.`
              : 'Ainda sem histórico. Cada vaga libertada que registar entra aqui e melhora a previsão.'
          }
        />
        {hist.length > 0 && (
          <div className="mt-10 max-w-2xl">
            <SaidasChart valores={hist} />
          </div>
        )}
        </section>
      </Reveal>

      <Reveal>
        <EstadiaForm lar={lar} />
      </Reveal>

      <Reveal>
        <section aria-labelledby="prev-metodo" className="tile">
        <h2 id="prev-metodo" className="text-xl font-semibold">
          Como calculamos
        </h2>
        <div className="mt-3 flex max-w-2xl flex-col gap-3 text-ink-soft">
          <p>
            Combinamos as saídas que registou nos últimos 12 meses com a rotatividade esperada para a sua ocupação — residentes a dividir pela estadia
            média — e ajustamos à época do ano: no inverno há mais saídas.
          </p>
          <p>O intervalo mostra entre que valores o número deverá ficar em 8 de cada 10 casos. É uma estimativa estatística, não uma garantia.</p>
        </div>
        <MoreLink to="/sobre#previsao" className="mt-3">
          Saber mais sobre a previsão
        </MoreLink>
        </section>
      </Reveal>
    </div>
  )
}
