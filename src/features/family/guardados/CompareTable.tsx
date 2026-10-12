import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, Minus, Star } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { precoReferencia } from '@/lib/matching'
import { estimarEspera, vagasLivres } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, QUARTO_CURTO } from '@/lib/labels'
import { euro, km, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { isAtiva } from '../shared/estado'
import { useMountAnimation } from '../shared/motion'
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

/** Conteúdo de uma coluna que desliza da direita quando a instituição é acrescentada à comparação. */
function ColunaEntra({ delay = 0, children, className }: { delay?: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // 20px cabe no espaçamento da célula: a tabela não ganha scroll horizontal durante a entrada
  useMountAnimation(ref, [{ opacity: 0, transform: 'translateX(20px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay })
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

/** Cartão (telemóvel) que entra a deslizar quando a instituição é acrescentada. */
function CartaoEntra({ delay, children }: { delay: number; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null)
  useMountAnimation(
    ref,
    [
      { opacity: 0, transform: 'translateX(48px) scale(0.96)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 700, delay },
  )
  return (
    <li ref={ref} className="w-[86%] max-w-[22rem] shrink-0 snap-center">
      {children}
    </li>
  )
}

/** Tabela lado a lado (2–3 instituições). O valor mais favorável de cada linha leva a indicação "Melhor". */
export function CompareTable({ lares, perfil, pedidos }: { lares: Lar[]; perfil: PerfilIdoso | undefined; pedidos: Candidatura[] }) {
  const [atual, setAtual] = useState(0)
  const faixa = useRef<HTMLUListElement>(null)
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
  const best = linhas.map(melhores)
  /** critérios em que cada instituição é a melhor (resumo no topo de cada cartão) */
  const ganha = dados.map((_, i) => linhas.filter((_l, j) => best[j]!.has(i)).map((l) => l.label.toLowerCase()))

  const onScroll = () => {
    const el = faixa.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const passo = first.offsetWidth + 12
    setAtual(Math.max(0, Math.min(dados.length - 1, Math.round(el.scrollLeft / passo))))
  }

  return (
    <>
      {/* telemóvel: um cartão por instituição, a deslizar com o dedo */}
      <div className="sm:hidden">
        <ul
          ref={faixa}
          onScroll={onScroll}
          aria-label="Instituições em comparação"
          data-lenis-prevent
          className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain overscroll-y-auto! px-5 pb-2 [scrollbar-width:none]"
        >
          {dados.map(({ lar }, i) => (
            <CartaoEntra key={lar.id} delay={i * 90}>
              <article aria-labelledby={`cmp-${lar.id}`} className="flex h-full flex-col rounded-[1.75rem] bg-sand p-5">
                <header className="flex items-center gap-3">
                  <div aria-hidden className="size-12 shrink-0 overflow-hidden rounded-xl">
                    <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
                  </div>
                  <div className="min-w-0">
                    <h3 id={`cmp-${lar.id}`} className="text-lg leading-snug font-semibold">
                      <Link to={`/lar/${lar.id}`} className="hover:underline">
                        {lar.nome}
                      </Link>
                    </h3>
                    <p className="text-sm text-ink-mute">{lar.localidade}</p>
                  </div>
                </header>
                <p className="mt-4 text-sm text-ink-soft">
                  {ganha[i]!.length ? (
                    <>
                      <span className="font-semibold text-terra-700">Melhor em</span> {ganha[i]!.join(', ')}.
                    </>
                  ) : (
                    'Não é a melhor em nenhum critério.'
                  )}
                </p>
                <dl className="mt-2 divide-y divide-line">
                  {linhas.map((l, j) => (
                    <div key={l.id} className="py-4">
                      <dt className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {l.label}
                          {l.hint && <span className="font-normal text-ink-mute"> · {l.hint}</span>}
                        </span>
                        {best[j]!.has(i) && <span className="shrink-0 text-xs font-semibold text-terra-700">Melhor</span>}
                      </dt>
                      <dd className="mt-2">{l.cells[i]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </CartaoEntra>
          ))}
        </ul>
        {dados.length > 1 && (
          <p className="mt-3 flex items-center justify-center gap-3 text-sm text-ink-mute">
            <span aria-hidden className="flex gap-1.5">
              {dados.map(({ lar }, i) => (
                <span
                  key={lar.id}
                  className={cn('size-2 rounded-full transition-[background-color,transform] duration-300', i === atual ? 'scale-110 bg-ink' : 'bg-line-strong')}
                />
              ))}
            </span>
            Deslize para comparar
          </p>
        )}
      </div>

      {/* ecrãs largos: tabela; as colunas novas entram a deslizar */}
      <div className="relative hidden overflow-x-auto overscroll-x-contain overscroll-y-auto! [scrollbar-width:thin] sm:block" data-lenis-prevent>
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">
            Comparação de {lares.length} instituições guardadas. “Melhor” assinala o valor mais favorável de cada linha.
          </caption>
          <thead>
            <tr>
              <td className="w-44" />
              {dados.map(({ lar }, i) => (
                <th key={lar.id} scope="col" className="px-6 pb-5 align-bottom font-normal">
                  <ColunaEntra delay={i * 100}>
                    <Link to={`/lar/${lar.id}`} className="block text-lg leading-snug font-semibold hover:underline">
                      {lar.nome}
                    </Link>
                    <span className="mt-0.5 block text-sm text-ink-mute">{lar.localidade}</span>
                  </ColunaEntra>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, j) => (
              <tr key={l.id} className="border-t border-line">
                <th scope="row" className="py-5 pr-4 align-top font-normal">
                  <span className="block text-sm font-medium text-ink">{l.label}</span>
                  {l.hint && <span className="mt-0.5 block text-xs text-ink-mute">{l.hint}</span>}
                </th>
                {dados.map(({ lar }, i) => (
                  <td key={lar.id} className="px-6 py-5 align-top">
                    <ColunaEntra delay={i * 100 + (j + 1) * 30}>
                      {l.cells[i]}
                      {best[j]!.has(i) && <span className="mt-2 block text-xs font-semibold text-terra-700">Melhor</span>}
                    </ColunaEntra>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
