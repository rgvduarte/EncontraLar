import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { NATUREZA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Secao, Subtitulo } from '../Secao'
import { QUARTO_TABELA, intervaloPreco, precoSocial, type DadosLar } from '../helpers'

export function PrecosSection({ lar, dados }: { lar: Lar; dados: DadosLar }) {
  const social = precoSocial(lar)
  const unidade = dados.centroDia ? 'lugares' : 'camas'

  return (
    <Secao
      id="ficha-precos"
      rotulo="Preços"
      titulo="Quanto custa, sem letra pequena"
      intro={
        social
          ? 'A mensalidade depende dos rendimentos. Estes são os intervalos indicados pela instituição.'
          : 'Mensalidade por pessoa, tal como indicada pela instituição.'
      }
    >
      <table className="w-full text-left">
        <caption className="sr-only">Mensalidade e lugares por tipo de {dados.centroDia ? 'frequência' : 'quarto'}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{dados.centroDia ? 'Frequência' : 'Tipo de quarto'}</th>
            <th scope="col">Mensalidade</th>
          </tr>
        </thead>
        <tbody className="border-t border-line">
          {lar.quartos.map((q) => (
            <tr key={q.tipo} className="border-b border-line">
              <th scope="row" className="py-5 pr-4 align-top font-normal">
                <span className="block text-lg font-semibold text-ink">{dados.centroDia ? 'Frequência diária' : QUARTO_TABELA[q.tipo]}</span>
                <span className="mt-0.5 block text-sm text-ink-mute">
                  {q.total} {unidade} ·{' '}
                  <span className={cn(q.livres > 0 && 'font-medium text-leaf-700')}>
                    {q.livres > 0 ? `${q.livres} ${q.livres === 1 ? 'livre' : 'livres'} hoje` : 'sem vaga hoje'}
                  </span>
                </span>
              </th>
              <td className="py-5 text-right align-top">
                <span className="block text-2xl font-semibold tracking-tight whitespace-nowrap text-ink tabular sm:text-3xl">
                  {intervaloPreco(q.precoMin, q.precoMax)}
                </span>
                <span className="block text-sm text-ink-mute">por mês</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-16 grid gap-12 md:grid-cols-2 md:gap-10">
        <div>
          <Subtitulo>Incluído</Subtitulo>
          {lar.incluido.length ? (
            <ul className="mt-4 border-t border-line">
              {lar.incluido.map((i) => (
                <li key={i} className="border-b border-line py-3.5 text-ink">
                  {i}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-mute">Ainda não detalhado — pergunte na visita.</p>
          )}
        </div>
        <div>
          <Subtitulo>Extras</Subtitulo>
          {lar.extras.length ? (
            <dl className="mt-4 border-t border-line">
              {lar.extras.map((e) => (
                <div key={e.nome} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
                  <dt className="text-ink">{e.nome}</dt>
                  <dd className="shrink-0 text-right text-ink-mute">{e.preco}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-ink-mute">Nenhum indicado. Confirme se há custos à parte (fraldas, consultas, transporte).</p>
          )}
        </div>
      </div>

      <div className="mt-16 max-w-[65ch]">
        <Subtitulo>{social ? `Como se calcula numa ${NATUREZA_LABEL[lar.natureza]}` : 'Preço fixo'}</Subtitulo>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          {social
            ? 'A comparticipação familiar é uma percentagem dos rendimentos de quem vai entrar, até ao máximo da tabela. Leve o IRS e os comprovativos de pensão à primeira reunião — a instituição faz a simulação consigo.'
            : 'A mensalidade é igual para todas as famílias, conforme o quarto e o nível de cuidados. Parte da despesa pode ser deduzida no IRS.'}{' '}
          {lar.acordoSS ? 'Tem vagas com acordo da Segurança Social.' : 'Não tem vagas comparticipadas pela Segurança Social.'}
        </p>
        <Link to="/guia#apoios" className="mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
          Apoios e comparticipações
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>
    </Secao>
  )
}
