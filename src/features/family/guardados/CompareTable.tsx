import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, Check, Clock, Cloud, CloudSun, ShieldQuestion, Sun, X } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { Stars } from '@/components/ui/Stars'
import { avaliarLar, precoReferencia, scoreLabel } from '@/lib/matching'
import { estimarEspera, vagasLivres } from '@/lib/forecast'
import { distanceKm } from '@/lib/geo'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, NATUREZA_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { euro, km, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { isAtiva } from '../shared/estado'
import { ordinal } from '../shared/text'

interface Linha {
  id: string
  label: ReactNode
  hint?: ReactNode
  cells: ReactNode[]
  /** valores numéricos para marcar o melhor (null = não comparável) */
  valores?: (number | null)[]
  melhor?: 'max' | 'min'
  /** texto da etiqueta do melhor valor (por omissão "melhor") */
  melhorTxt?: string
}

function nivel(p: number) {
  if (p >= 0.66) return { Icon: Sun, cor: 'text-leaf-700', txt: 'provável' }
  if (p >= 0.33) return { Icon: CloudSun, cor: 'text-sun-800', txt: 'possível' }
  return { Icon: Cloud, cor: 'text-dusk-700', txt: 'pouco provável' }
}

function Prob({ p }: { p: number }) {
  const n = nivel(p)
  return (
    <span className="inline-flex items-center gap-2">
      <n.Icon aria-hidden className={cn('size-6', n.cor)} strokeWidth={1.8} />
      <span className={cn('font-display text-2xl leading-none font-semibold tabular', n.cor)}>{pct(p)}</span>
      <span className="text-sm text-ink-soft">{n.txt}</span>
    </span>
  )
}

const Sim = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-start gap-1.5 font-semibold text-leaf-700">
    <Check aria-hidden strokeWidth={3} className="mt-1 size-4 shrink-0" />
    <span>{children}</span>
  </span>
)
const Nao = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-start gap-1.5 text-ink-soft">
    <X aria-hidden strokeWidth={3} className="mt-1 size-4 shrink-0 text-ink-mute" />
    <span>{children}</span>
  </span>
)

/** Tabela lado a lado (2–3 instituições), com o melhor valor de cada linha assinalado por texto. */
export function CompareTable({ lares, perfil, pedidos }: { lares: Lar[]; perfil: PerfilIdoso | undefined; pedidos: Candidatura[] }) {
  const dados = lares.map((lar) => {
    const pedido = pedidos.find((c) => c.larId === lar.id && isAtiva(c) && c.posicao != null)
    return {
      lar,
      pedido,
      est: estimarEspera(lar, pedido?.posicao != null ? { posicao: pedido.posicao } : {}),
      match: perfil ? avaliarLar(lar, perfil) : undefined,
      dist: perfil ? distanceKm(perfil.local, lar) : undefined,
      preco: precoReferencia(lar, perfil?.quarto ?? 'indiferente'),
    }
  })

  const linhas: Linha[] = []
  if (perfil) {
    linhas.push({
      id: 'match',
      label: 'Compatibilidade',
      hint: `com o perfil de ${perfil.nome.split(' ')[0]}`,
      cells: dados.map((d) => (
        <span className="flex flex-col">
          <span className="font-display text-2xl leading-none font-semibold tabular">{d.match!.score}%</span>
          <span className="mt-1 text-sm text-ink-soft">{d.match!.compativel ? scoreLabel(d.match!.score) : 'Falha um requisito essencial'}</span>
        </span>
      )),
      valores: dados.map((d) => d.match!.score),
      melhor: 'max',
    })
  }
  linhas.push(
    {
      id: 'preco',
      label: 'Mensalidade',
      hint: perfil && perfil.quarto !== 'indiferente' ? `quarto ${QUARTO_CURTO[perfil.quarto].toLowerCase()}` : 'valor mais baixo',
      cells: dados.map((d) => (
        <span className="flex flex-col">
          <span className="font-display text-2xl leading-none font-semibold tabular">desde {euro(d.preco)}</span>
          <span className="mt-1 text-sm text-ink-soft">
            {d.lar.natureza === 'privado' ? 'preço fixo' : `${NATUREZA_LABEL[d.lar.natureza]}: conforme rendimentos`}
          </span>
        </span>
      )),
      valores: dados.map((d) => d.preco),
      melhor: 'min',
      melhorTxt: 'mais baixa',
    },
    {
      id: 'vaga',
      label: 'Vaga agora',
      cells: dados.map((d) => {
        const n = vagasLivres(d.lar)
        const q = d.lar.quartos.find((x) => x.livres > 0)
        return n > 0 ? (
          <Sim>
            Sim — {n === 1 ? '1 vaga' : `${n} vagas`}
            {q && <span className="block text-sm font-normal text-ink-soft">quarto {QUARTO_CURTO[q.tipo].toLowerCase()}</span>}
          </Sim>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-dusk-700">
            <Clock aria-hidden className="size-4" />
            Não, lista de espera
          </span>
        )
      }),
      valores: dados.map((d) => (vagasLivres(d.lar) > 0 ? 1 : 0)),
      melhor: 'max',
    },
    {
      id: 'p3',
      label: 'Vaga até 3 meses',
      hint: 'probabilidade estimada',
      cells: dados.map((d) => <Prob p={d.est.p90} />),
      valores: dados.map((d) => Math.round(d.est.p90 * 100)),
      melhor: 'max',
    },
    {
      id: 'p6',
      label: 'Vaga até 6 meses',
      hint: 'com o seu lugar na lista, se já pediu vaga',
      cells: dados.map((d) => (
        <span className="flex flex-col gap-1">
          <Prob p={d.est.p180} />
          {d.pedido?.posicao != null && <span className="text-sm text-ink-soft">está em {ordinal(d.pedido.posicao)} na lista</span>}
        </span>
      )),
      valores: dados.map((d) => Math.round(d.est.p180 * 100)),
      melhor: 'max',
    },
  )

  const chave = perfil?.necessidades.length ? perfil.necessidades : null
  linhas.push({
    id: 'cuidados',
    label: 'Cuidados-chave',
    hint: chave ? 'os que o perfil precisa' : 'principais cuidados',
    cells: dados.map((d) => (
      <ul className="flex flex-col gap-1 text-sm">
        {(chave ?? CUIDADOS_ORDEM.filter((c) => d.lar.cuidados.includes(c)).slice(0, 4)).map((c) => (
          <li key={c}>{d.lar.cuidados.includes(c) ? <Sim>{CUIDADO_LABEL[c]}</Sim> : <Nao>{CUIDADO_LABEL[c]}</Nao>}</li>
        ))}
      </ul>
    )),
    valores: chave ? dados.map((d) => chave.filter((c) => d.lar.cuidados.includes(c)).length) : undefined,
    melhor: 'max',
  })
  linhas.push(
    {
      id: 'equipa',
      label: 'Cuidadores',
      hint: 'por cada 10 residentes',
      cells: dados.map((d) => (
        <span className="flex flex-col">
          <span className="font-display text-2xl leading-none font-semibold tabular">
            {d.lar.equipa.cuidadoresPor10.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}
          </span>
          <span className="mt-1 text-sm text-ink-soft">
            {d.lar.equipa.enfermeiros} enfermeiros · médico {d.lar.equipa.medicoHorasSemana} h/semana
          </span>
        </span>
      )),
      valores: dados.map((d) => d.lar.equipa.cuidadoresPor10),
      melhor: 'max',
    },
    {
      id: 'avaliacao',
      label: 'Avaliação das famílias',
      cells: dados.map((d) =>
        d.lar.numAvaliacoes > 0 ? (
          <span className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2">
              <span className="font-display text-2xl leading-none font-semibold tabular">
                {d.lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1 })}
              </span>
              <Stars value={d.lar.avaliacao} />
            </span>
            <span className="text-sm text-ink-soft">{d.lar.numAvaliacoes} opiniões</span>
          </span>
        ) : (
          <span className="text-ink-soft">Ainda sem opiniões</span>
        ),
      ),
      valores: dados.map((d) => (d.lar.numAvaliacoes > 0 ? d.lar.avaliacao : null)),
      melhor: 'max',
    },
  )
  if (perfil) {
    linhas.push({
      id: 'distancia',
      label: `Distância a ${perfil.local.label}`,
      cells: dados.map((d) => (
        <span className="font-display text-2xl leading-none font-semibold tabular">{km(d.dist!)}</span>
      )),
      valores: dados.map((d) => Math.round(d.dist! * 10)),
      melhor: 'min',
      melhorTxt: 'mais perto',
    })
  }
  linhas.push(
    {
      id: 'ss',
      label: 'Acordo com a Segurança Social',
      hint: 'vagas comparticipadas',
      cells: dados.map((d) => (d.lar.acordoSS ? <Sim>Sim</Sim> : <Nao>Não</Nao>)),
    },
    {
      id: 'verif',
      label: 'Verificação EncontraLar',
      cells: dados.map((d) =>
        d.lar.verificacao.estado === 'verificado' ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-pine-700">
            <BadgeCheck aria-hidden className="size-4.5" />
            Visitada e verificada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <ShieldQuestion aria-hidden className="size-4.5" />
            {d.lar.verificacao.estado === 'pendente' ? 'Verificação em curso' : 'Não verificada'}
          </span>
        ),
      ),
    },
  )

  const melhores = (l: Linha): Set<number> => {
    if (!l.valores || !l.melhor) return new Set()
    const v = l.valores.filter((x): x is number => x != null)
    if (v.length < 2 || new Set(v).size === 1) return new Set()
    const alvo = l.melhor === 'max' ? Math.max(...v) : Math.min(...v)
    return new Set(l.valores.flatMap((x, i) => (x === alvo ? [i] : [])))
  }

  return (
    <div className="overflow-x-auto rounded-[1.75rem] border border-line bg-white shadow-card [scrollbar-width:thin]">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">
          Comparação lado a lado de {lares.length} instituições guardadas. A indicação “melhor” assinala o valor mais favorável de cada
          linha.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-[2] w-40 bg-white p-4 align-bottom sm:w-48 sm:p-5">
              <span className="text-sm font-bold text-ink-soft">{lares.length} instituições</span>
            </th>
            {dados.map(({ lar }) => (
              <th key={lar.id} scope="col" className="min-w-52 border-l border-line p-4 align-top font-normal sm:p-5">
                <span aria-hidden className="block aspect-[16/9] overflow-hidden rounded-xl border border-line">
                  <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
                </span>
                <Link to={`/lar/${lar.id}`} className="mt-3 block font-display text-lg leading-snug font-semibold hover:underline">
                  {lar.nome}
                </Link>
                <span className="mt-0.5 block text-sm text-ink-soft">{lar.localidade}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, li) => {
            const best = melhores(l)
            return (
              <tr key={l.id} className={cn('border-t border-line', li % 2 === 1 && 'bg-cream/70')}>
                <th scope="row" className={cn('sticky left-0 z-[1] p-4 align-top sm:p-5', li % 2 === 1 ? 'bg-cream' : 'bg-white')}>
                  <span className="block text-sm leading-snug font-bold">{l.label}</span>
                  {l.hint && <span className="mt-0.5 block text-xs leading-snug text-ink-soft">{l.hint}</span>}
                </th>
                {l.cells.map((cell, i) => (
                  <td key={i} className="border-l border-line p-4 align-top sm:p-5">
                    {cell}
                    {best.has(i) && (
                      <span className="mt-2 block w-fit rounded-full bg-terra-50 px-2.5 py-0.5 text-xs font-bold text-terra-800 ring-1 ring-terra-200">
                        {l.melhorTxt ?? 'melhor'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
