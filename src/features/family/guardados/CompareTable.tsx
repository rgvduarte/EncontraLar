import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, Minus, Star } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { precoReferencia } from '@/lib/matching'
import { estimarEspera, vagasLivres } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, QUARTO_CURTO } from '@/lib/labels'
import { euro, km, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { isAtiva } from '../shared/estado'
import { ordinal } from '../shared/text'

interface Linha {
  id: string
  label: string
  hint?: string
  cells: ReactNode[]
  /** valores para assinalar o melhor (null = não comparável) */
  valores?: (number | null)[]
  melhor?: 'max' | 'min'
}

function Prob({ p }: { p: number }) {
  const txt = p >= 0.66 ? 'provável' : p >= 0.33 ? 'possível' : 'pouco provável'
  const cor = p >= 0.66 ? 'text-leaf-700' : p >= 0.33 ? 'text-sun-800' : 'text-ink-mute'
  return (
    <span className="flex flex-col">
      <span className="text-2xl leading-none font-semibold tabular">{pct(p)}</span>
      <span className={cn('mt-1.5 text-sm', cor)}>{txt}</span>
    </span>
  )
}

const Num = ({ v, sub }: { v: ReactNode; sub?: ReactNode }) => (
  <span className="flex flex-col">
    <span className="text-2xl leading-none font-semibold tabular">{v}</span>
    {sub && <span className="mt-1.5 text-sm text-ink-mute">{sub}</span>}
  </span>
)

/** Tabela lado a lado (2–3 instituições). O valor mais favorável de cada linha leva a indicação "Melhor". */
export function CompareTable({ lares, perfil, pedidos }: { lares: Lar[]; perfil: PerfilIdoso | undefined; pedidos: Candidatura[] }) {
  const dados = lares.map((lar) => {
    const pedido = pedidos.find((c) => c.larId === lar.id && isAtiva(c) && c.posicao != null)
    return {
      lar,
      pedido,
      est: estimarEspera(lar, pedido?.posicao != null ? { posicao: pedido.posicao } : {}),
      dist: perfil ? distanceKm(perfil.local, lar) : undefined,
      preco: precoReferencia(lar, perfil?.quarto ?? 'indiferente'),
    }
  })
  const chave = perfil?.necessidades.length ? perfil.necessidades : null

  const linhas: Linha[] = [
    {
      id: 'preco',
      label: 'Mensalidade',
      hint: perfil && perfil.quarto !== 'indiferente' ? `desde, quarto ${QUARTO_CURTO[perfil.quarto].toLowerCase()}` : 'desde',
      cells: dados.map((d) => <Num v={euro(d.preco)} sub={d.lar.natureza === 'privado' ? 'preço fixo' : 'conforme rendimentos'} />),
      valores: dados.map((d) => d.preco),
      melhor: 'min',
    },
    {
      id: 'vaga',
      label: 'Vaga agora',
      cells: dados.map((d) => {
        const n = vagasLivres(d.lar)
        const q = d.lar.quartos.find((x) => x.livres > 0)
        return n > 0 ? (
          <span className="flex flex-col">
            <span className="inline-flex items-center gap-2 font-semibold text-leaf-700">
              <span aria-hidden className="size-2 rounded-full bg-leaf-500" />
              Sim, {n === 1 ? '1 vaga' : `${n} vagas`}
            </span>
            {q && <span className="mt-1 text-sm text-ink-mute">quarto {QUARTO_CURTO[q.tipo].toLowerCase()}</span>}
          </span>
        ) : (
          <span className="text-ink-mute">Não</span>
        )
      }),
    },
    {
      id: 'p3',
      label: 'Previsão a 3 meses',
      hint: 'probabilidade de vaga',
      cells: dados.map((d) => <Prob p={d.est.p90} />),
      valores: dados.map((d) => Math.round(d.est.p90 * 100)),
      melhor: 'max',
    },
    {
      id: 'p6',
      label: 'Previsão a 6 meses',
      hint: 'com o seu lugar, se já pediu',
      cells: dados.map((d) => (
        <span className="flex flex-col">
          <Prob p={d.est.p180} />
          {d.pedido?.posicao != null && <span className="text-sm text-ink-mute">em {ordinal(d.pedido.posicao)} na lista</span>}
        </span>
      )),
      valores: dados.map((d) => Math.round(d.est.p180 * 100)),
      melhor: 'max',
    },
    {
      id: 'cuidados',
      label: 'Cuidados-chave',
      hint: chave ? 'os que o perfil precisa' : undefined,
      cells: dados.map((d) => (
        <ul className="flex flex-col gap-1.5 text-sm">
          {(chave ?? CUIDADOS_ORDEM.filter((c) => d.lar.cuidados.includes(c)).slice(0, 4)).map((c) => {
            const tem = d.lar.cuidados.includes(c)
            return (
              <li key={c} className={cn('flex items-start gap-2', tem ? 'text-ink' : 'text-ink-mute')}>
                {tem ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf-600" /> : <Minus aria-hidden className="mt-0.5 size-4 shrink-0" />}
                <span>
                  {CUIDADO_LABEL[c]}
                  {!tem && <span className="sr-only"> (não tem)</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )),
      valores: chave ? dados.map((d) => chave.filter((c) => d.lar.cuidados.includes(c)).length) : undefined,
      melhor: 'max',
    },
    {
      id: 'equipa',
      label: 'Cuidadores',
      hint: 'por cada 10 residentes',
      cells: dados.map((d) => <Num v={d.lar.equipa.cuidadoresPor10.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} />),
      valores: dados.map((d) => d.lar.equipa.cuidadoresPor10),
      melhor: 'max',
    },
    {
      id: 'avaliacao',
      label: 'Avaliação',
      cells: dados.map((d) =>
        d.lar.numAvaliacoes > 0 ? (
          <Num
            v={
              <span className="inline-flex items-center gap-1.5">
                <Star aria-hidden className="size-5 fill-ink text-ink" />
                {d.lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1 })}
              </span>
            }
            sub={`${d.lar.numAvaliacoes} opiniões`}
          />
        ) : (
          <span className="text-ink-mute">Sem opiniões</span>
        ),
      ),
      valores: dados.map((d) => (d.lar.numAvaliacoes > 0 ? d.lar.avaliacao : null)),
      melhor: 'max',
    },
  ]
  if (perfil) {
    linhas.push({
      id: 'distancia',
      label: 'Distância',
      hint: `a ${perfil.local.label}`,
      cells: dados.map((d) => <Num v={km(d.dist!)} />),
      valores: dados.map((d) => Math.round(d.dist! * 10)),
      melhor: 'min',
    })
  }

  const melhores = (l: Linha): Set<number> => {
    if (!l.valores || !l.melhor) return new Set()
    const v = l.valores.filter((x): x is number => x != null)
    if (v.length < 2 || new Set(v).size === 1) return new Set()
    const alvo = l.melhor === 'max' ? Math.max(...v) : Math.min(...v)
    return new Set(l.valores.flatMap((x, i) => (x === alvo ? [i] : [])))
  }

  const n = dados.length
  const cols = n === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <>
      {/* telemóvel: critério a critério, valores lado a lado */}
      <div className="sm:hidden">
        <ul className={cn('grid gap-3 pb-4', cols)} aria-label="Instituições em comparação">
          {dados.map(({ lar }) => (
            <li key={lar.id}>
              <Link to={`/lar/${lar.id}`} className="block text-base leading-snug font-semibold hover:underline">
                {lar.nome}
              </Link>
            </li>
          ))}
        </ul>
        {linhas.map((l) => {
          const best = melhores(l)
          return (
            <section key={l.id} aria-label={l.label} className="border-t border-line py-5">
              <p className="text-sm font-medium">
                {l.label}
                {l.hint && <span className="font-normal text-ink-mute"> · {l.hint}</span>}
              </p>
              <dl className={cn('mt-3 grid gap-3', cols)}>
                {l.cells.map((cell, i) => (
                  <div key={i} className="min-w-0">
                    <dt className="truncate text-xs text-ink-mute">{dados[i]!.lar.nome}</dt>
                    <dd className="mt-1 text-[0.9375rem] [&_.text-2xl]:text-xl">
                      {cell}
                      {best.has(i) && <span className="mt-1.5 block text-xs font-semibold text-terra-700">Melhor</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
      </div>

      {/* ecrãs largos: tabela */}
      <div className="hidden overflow-x-auto [scrollbar-width:thin] sm:block">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">
            Comparação de {lares.length} instituições guardadas. “Melhor” assinala o valor mais favorável de cada linha.
          </caption>
          <thead>
            <tr>
              <td className="w-44" />
              {dados.map(({ lar }) => (
                <th key={lar.id} scope="col" className="px-6 pb-5 align-bottom font-normal">
                  <Link to={`/lar/${lar.id}`} className="block text-lg leading-snug font-semibold hover:underline">
                    {lar.nome}
                  </Link>
                  <span className="mt-0.5 block text-sm text-ink-mute">{lar.localidade}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const best = melhores(l)
              return (
                <tr key={l.id} className="border-t border-line">
                  <th scope="row" className="py-5 pr-4 align-top font-normal">
                    <span className="block text-sm font-medium text-ink">{l.label}</span>
                    {l.hint && <span className="mt-0.5 block text-xs text-ink-mute">{l.hint}</span>}
                  </th>
                  {l.cells.map((cell, i) => (
                    <td key={i} className="px-6 py-5 align-top">
                      {cell}
                      {best.has(i) && <span className="mt-2 block text-xs font-semibold text-terra-700">Melhor</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
