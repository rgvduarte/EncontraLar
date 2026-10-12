import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { azulejoBg } from '@/components/brand/patterns'
import { euro, tempoRelativo } from '@/lib/format'
import { NATUREZA_LABEL, QUARTO_CURTO, TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

const mesPorExtenso = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

const ITENS = [
  {
    titulo: 'Preço real por tipo de quarto',
    texto: 'A mensalidade de cada quarto, não um «sob consulta». Nas IPSS e Misericórdias, o intervalo conforme os rendimentos.',
  },
  { titulo: 'Rácio de cuidadores', texto: 'Quantos cuidadores há por cada 10 residentes, quantos enfermeiros e quantas horas de médico.' },
  { titulo: 'Licença de funcionamento', texto: 'O número do alvará emitido pela Segurança Social, para poder confirmar.' },
  { titulo: 'Última inspeção', texto: 'Quando foi a última inspeção oficial conhecida às instalações.' },
  { titulo: 'Data de atualização', texto: 'Quando a instituição confirmou as vagas pela última vez. Se já passaram dias, confirme por telefone.' },
]

function Marca({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-terra-600 font-display text-base font-semibold text-white shadow-soft ring-4 ring-white',
        className,
      )}
    >
      {n}
    </span>
  )
}

/** Excerto de uma ficha verificada real, anotado como numa revista. */
function FichaExcerto({ lar, agora }: { lar: Lar; agora: number }) {
  const anoVerificacao = lar.verificacao.data ? new Date(lar.verificacao.data).getFullYear() : undefined
  const privado = lar.natureza === 'privado'
  return (
    <div className="relative rounded-[1.5rem] border border-line bg-white p-5 pt-6 shadow-lift sm:p-8">
      <SeloVerificado ano={anoVerificacao} size={116} className="absolute -top-10 -right-1 drop-shadow-sm sm:-top-12 sm:-right-8" />

      <div className="relative pr-20 sm:pr-24">
        <p className="text-xs font-bold tracking-[0.14em] text-ink-mute uppercase">Ficha da instituição</p>
        <p className="mt-1 font-display text-2xl leading-tight font-semibold sm:text-3xl">{lar.nome}</p>
        <p className="mt-1 text-ink-soft">
          {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
        </p>
      </div>

      <div className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-leaf-50 py-1 pr-4 pl-1 text-sm font-bold text-leaf-700">
        <Marca n={5} className="size-7 text-sm ring-2" />
        Vagas atualizadas {tempoRelativo(lar.atualizadoEm, new Date(agora))}
      </div>

      {/* 1 · preços */}
      <div className="relative mt-6 border-t border-line pt-5">
        <p className="flex items-center gap-2.5 font-bold">
          <Marca n={1} className="sm:absolute sm:top-4 sm:-left-12" />
          {privado ? 'Mensalidade por tipo de quarto' : 'Mensalidade conforme rendimentos'}
        </p>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-sm text-ink-mute">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Quarto
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                Mensalidade
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                Livres hoje
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-line-strong">
            {lar.quartos.map((q) => (
              <tr key={q.tipo}>
                <th scope="row" className="py-2.5 pr-3 font-semibold">
                  {QUARTO_CURTO[q.tipo]}
                </th>
                <td className="py-2.5 pr-3 font-display text-base font-semibold whitespace-nowrap tabular sm:text-lg">
                  {euro(q.precoMin)}–{euro(q.precoMax)}
                </td>
                <td className={cn('py-2.5 text-right font-bold whitespace-nowrap tabular', q.livres ? 'text-leaf-700' : 'text-ink-mute')}>
                  {q.livres ? `${q.livres} livre${q.livres > 1 ? 's' : ''}` : 'nenhum'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2 · equipa */}
      <div className="relative mt-5 border-t border-line pt-5">
        <p className="flex items-center gap-2.5 font-bold">
          <Marca n={2} className="sm:absolute sm:top-4 sm:-left-12" />
          Equipa
        </p>
        <dl className="mt-2 grid grid-cols-3 gap-3">
          <div className="flex flex-col">
            <dt className="order-last text-sm leading-snug text-ink-soft">cuidadores por 10 residentes</dt>
            <dd className="font-display text-3xl font-semibold tabular">{lar.equipa.cuidadoresPor10.toLocaleString('pt-PT')}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="order-last text-sm leading-snug text-ink-soft">{lar.equipa.enfermeiros === 1 ? 'enfermeiro' : 'enfermeiros'}</dt>
            <dd className="font-display text-3xl font-semibold tabular">{lar.equipa.enfermeiros}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="order-last text-sm leading-snug text-ink-soft">horas de médico por semana</dt>
            <dd className="font-display text-3xl font-semibold tabular">{lar.equipa.medicoHorasSemana}</dd>
          </div>
        </dl>
      </div>

      {/* 3 e 4 · licença e inspeção, como linhas de um registo */}
      <dl className="mt-5 border-t border-line pt-2">
        <div className="relative flex flex-wrap items-baseline gap-x-2 py-2.5">
          <dt className="flex items-center gap-2.5 text-ink-soft">
            <Marca n={3} className="sm:absolute sm:top-2 sm:-left-12" />
            Licença de funcionamento
          </dt>
          <span aria-hidden className="hidden min-w-4 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line-strong sm:block" />
          <dd className="ml-auto font-bold tabular">N.º {lar.verificacao.licenca}</dd>
        </div>
        {lar.verificacao.ultimaInspecao && (
          <div className="relative flex flex-wrap items-baseline gap-x-2 border-t border-dashed border-line-strong py-2.5">
            <dt className="flex items-center gap-2.5 text-ink-soft">
              <Marca n={4} className="sm:absolute sm:top-2 sm:-left-12" />
              Última inspeção
            </dt>
            <span aria-hidden className="hidden min-w-4 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line-strong sm:block" />
            <dd className="ml-auto font-bold first-letter:uppercase">{mesPorExtenso(lar.verificacao.ultimaInspecao)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

export function TransparencySection({ lar, agora }: { lar: Lar | null; agora: number }) {
  if (!lar) return null
  return (
    <section aria-labelledby="transparencia-titulo" className="relative overflow-hidden border-y border-line bg-sand py-16 lg:py-24">
      <div aria-hidden className="absolute inset-y-0 right-0 hidden w-[38%] lg:block" style={azulejoBg('#1d564e', 0.09, 64)} />
      <div className="container-page relative grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="eyebrow">Transparência</p>
          <h2 id="transparencia-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
            Tudo à vista, <em>antes</em> de telefonar.
          </h2>
          <p className="mt-6 text-lg text-ink-soft">
            Escolher um lar «de boca em boca» deixa demasiado por saber. Todas as fichas mostram o mesmo, da mesma forma — para poder
            comparar com calma.
          </p>
          <ol className="mt-8 flex flex-col gap-5">
            {ITENS.map((it, i) => (
              <li key={it.titulo} className="flex gap-4">
                <Marca n={i + 1} className="mt-0.5 ring-sand" />
                <div>
                  <p className="font-bold text-ink">{it.titulo}</p>
                  <p className="text-ink-soft">{it.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <figure className="lg:col-span-6 lg:col-start-7 lg:pt-10">
          <FichaExcerto lar={lar} agora={agora} />
          <figcaption className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 text-sm text-ink-soft">
            <span>Excerto da ficha de {lar.nome}, com o selo de instituição verificada.</span>
            <Link to={`/lar/${lar.id}`} className="link group inline-flex min-h-11 items-center gap-1.5">
              Ver a ficha completa <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
