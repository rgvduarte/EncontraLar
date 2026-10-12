import { Link } from 'react-router'
import { ArrowRight, Check, Landmark, Receipt } from 'lucide-react'
import type { Lar } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { NATUREZA_LABEL } from '@/lib/labels'
import { LinhaPontilhada, Secao, Subtitulo } from '../Secao'
import { QUARTO_TABELA, intervaloPreco, precoSocial, type DadosLar } from '../helpers'

export function PrecosSection({ lar, dados, numero }: { lar: Lar; dados: DadosLar; numero: number }) {
  const social = precoSocial(lar)

  return (
    <Secao
      id="ficha-precos"
      numero={numero}
      rotulo="Preços"
      titulo={
        <>
          Quanto <em>custa</em>, sem letra pequena
        </>
      }
      intro={
        social
          ? 'Numa instituição sem fins lucrativos, a mensalidade depende dos rendimentos. Os valores abaixo são os intervalos indicados pela instituição.'
          : 'Mensalidade por pessoa, por tipo de quarto, tal como indicada pela instituição.'
      }
    >
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        <table className="w-full text-left">
          <caption className="sr-only">Mensalidade e lugares por tipo de {dados.centroDia ? 'frequência' : 'quarto'}</caption>
          <thead className="bg-sand/70 text-xs font-bold tracking-[0.1em] text-ink-mute uppercase">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold sm:px-6">{dados.centroDia ? 'Frequência' : 'Tipo de quarto'}</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-bold sm:table-cell">{dados.centroDia ? 'Lugares' : 'Camas'}</th>
              <th scope="col" className="hidden px-3 py-3 text-right font-bold sm:table-cell">Livres hoje</th>
              <th scope="col" className="px-5 py-3 text-right font-bold sm:px-6">Mensalidade{social ? '*' : ''}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lar.quartos.map((q) => (
              <tr key={q.tipo}>
                <th scope="row" className="px-5 py-4 font-semibold text-ink sm:px-6">
                  {dados.centroDia ? 'Frequência diária' : QUARTO_TABELA[q.tipo]}
                  <span className="mt-0.5 block text-sm font-normal text-ink-soft sm:hidden">
                    {q.livres > 0 ? (
                      <span className="font-bold text-leaf-700">{q.livres} {q.livres === 1 ? 'livre' : 'livres'}</span>
                    ) : (
                      'Sem lugares livres'
                    )}{' '}
                    · {q.total} {dados.centroDia ? 'lugares' : 'camas'}
                  </span>
                </th>
                <td className="hidden px-3 py-4 text-right text-ink-soft tabular sm:table-cell">{q.total}</td>
                <td className="hidden px-3 py-4 text-right tabular sm:table-cell">
                  {q.livres > 0 ? (
                    <Badge tone="leaf">{q.livres} {q.livres === 1 ? 'livre' : 'livres'}</Badge>
                  ) : (
                    <span className="text-ink-mute">0</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right font-display text-lg font-semibold whitespace-nowrap text-ink tabular sm:px-6 sm:text-xl">
                  {intervaloPreco(q.precoMin, q.precoMax)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {social && (
          <p className="border-t border-line bg-sand/40 px-5 py-3 text-sm text-ink-soft sm:px-6">
            * Intervalo da comparticipação familiar: o valor exato é calculado sobre os rendimentos (ver abaixo).
          </p>
        )}
      </div>

      <div className="mt-10">
        <Subtitulo>Incluído na mensalidade</Subtitulo>
        {lar.incluido.length ? (
          <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {lar.incluido.map((i) => (
              <li key={i} className="flex items-start gap-3 py-1.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf-50 text-leaf-600">
                  <Check aria-hidden className="size-4" strokeWidth={3} />
                </span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-soft">A instituição ainda não detalhou o que está incluído — pergunte na visita.</p>
        )}
      </div>

      <div className="mt-10">
        <Subtitulo>Extras, pagos à parte</Subtitulo>
        {lar.extras.length ? (
          <dl className="mt-3">
            {lar.extras.map((e) => (
              <LinhaPontilhada key={e.nome} termo={e.nome} valor={e.preco} />
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-ink-soft">Não foram indicados extras. Confirme se há custos adicionais (fraldas, consultas, transporte).</p>
        )}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        {social ? (
          <div className="rounded-3xl border border-pine-200 bg-pine-50/60 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Landmark aria-hidden className="size-5 text-pine-700" />
              <p className="font-bold text-ink">Como se calcula a mensalidade numa {NATUREZA_LABEL[lar.natureza]}</p>
            </div>
            <p className="mt-3 text-ink-soft">
              A comparticipação familiar é uma <strong className="text-ink">percentagem dos rendimentos</strong> da pessoa que vai entrar (e, em certos
              casos, do agregado familiar), até ao valor máximo indicado na tabela. Por isso duas famílias podem pagar valores diferentes pelo mesmo quarto.
            </p>
            <p className="mt-3 text-ink-soft">Leve à primeira reunião a declaração de IRS e os comprovativos de pensão — a instituição faz a simulação consigo.</p>
            <div className="mt-4">
              {lar.acordoSS ? (
                <Badge tone="pine" size="md" icon={<Check aria-hidden />}>
                  Tem vagas com acordo da Segurança Social
                </Badge>
              ) : (
                <Badge tone="neutral" size="md">
                  Sem acordo de cooperação com a Segurança Social
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-line bg-white p-6">
            <p className="flex items-center gap-2 font-bold text-ink">
              <Landmark aria-hidden className="size-5 text-pine-700" />
              Instituição privada: preço fixo
            </p>
            <p className="mt-2 text-ink-soft">
              A mensalidade não depende dos rendimentos: é a mesma para todas as famílias, conforme o quarto e o nível de cuidados.
            </p>
            <div className="mt-4">
              <Badge tone={lar.acordoSS ? 'pine' : 'neutral'} size="md">
                {lar.acordoSS ? 'Tem vagas com acordo da Segurança Social' : 'Sem vagas comparticipadas pela Segurança Social'}
              </Badge>
            </div>
          </div>
        )}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-line bg-white p-6">
          <div>
            <p className="flex items-center gap-2 font-bold text-ink">
              <Receipt aria-hidden className="size-5 text-terra-600" />
              Pode deduzir no IRS
            </p>
            <p className="mt-2 text-ink-soft">Parte das despesas com lares e apoio domiciliário pode ser deduzida no IRS de quem as paga.</p>
          </div>
          <Link to="/guia#apoios" className="link inline-flex items-center gap-1.5 self-start">
            Apoios e comparticipações <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </Secao>
  )
}
