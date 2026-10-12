/**
 * Quatro funcionalidades em grelha "bento": título curto, uma frase e um pedaço de UI real.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { useCandidaturasDoLar } from '@/lib/store'
import { previsaoMensal, taxaOcupacao } from '@/lib/forecast'
import { MESES_CURTOS, MESES_LONGOS, num, pct, tempoRelativo } from '@/lib/format'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO, URGENCIA_LABEL } from '@/lib/labels'
import { LarCard } from '@/components/lar/LarCard'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'
import { SectionTitle } from '../shared/ui'
import { nomeCurto, type Ensaio } from './ensaio'
import { Stepper } from './ProductShot'

function Tile({ title, text, plano, children, className, delay = 0 }: { title: string; text: string; plano?: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn('flex flex-col rounded-[1.75rem] bg-sand p-7 sm:p-10', className)}>
      <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-[40ch] text-lg text-ink-mute">{text}</p>
      {plano && <p className="mt-2 text-sm text-ink-mute">{plano}</p>}
      <div className="mt-8 flex flex-1 flex-col justify-end">{children}</div>
    </Reveal>
  )
}

/** O cartão que as famílias veem na pesquisa, ao lado do botão que o muda. */
function VistaFamilia({ ensaio }: { ensaio: Ensaio }) {
  const base = ensaio.lar
  const q = base.quartos.find((x) => (ensaio.livres[x.tipo] ?? 0) > 0) ?? base.quartos[0]
  const [tipo] = useState(q?.tipo)
  const quarto = base.quartos.find((x) => x.tipo === tipo)
  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite">
        <LarCard lar={ensaio.lar} layout="horizontal" className="shadow-soft" />
      </div>
      {quarto && (
        <div className="flex items-center justify-between gap-4 rounded-[1.25rem] bg-white py-2 pr-2 pl-5 shadow-soft">
          <p className="text-base text-ink">
            <span className="hidden sm:inline">Vagas em quarto </span>
            <span className="sm:hidden">Quarto </span>
            <span className="lowercase">{QUARTO_CURTO[quarto.tipo]}</span>
          </p>
          <Stepper tipo={quarto.tipo} n={ensaio.livres[quarto.tipo] ?? 0} max={quarto.total} onChange={(d) => ensaio.mudar(quarto.tipo, d)} />
        </div>
      )}
    </div>
  )
}

function escolherPedido(cands: Candidatura[]): Candidatura | undefined {
  return cands.find((c) => c.estado === 'enviada' && c.perfil.necessidades.length > 0) ?? cands.find((c) => c.estado === 'em_analise') ?? cands[0]
}

function Pedido({ lar }: { lar: Lar }) {
  const cands = useCandidaturasDoLar(lar.id)
  const c = useMemo(() => escolherPedido(cands), [cands])
  if (!c) return null
  const p = c.perfil
  const linhas = [
    { t: GRAU_LABEL[p.grau], ok: lar.graus.includes(p.grau) },
    ...p.necessidades.map((n) => ({ t: CUIDADO_LABEL[n], ok: lar.cuidados.includes(n) })),
  ]
  const tudo = linhas.every((x) => x.ok)
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-terra-600">Novo pedido</p>
        <p className="text-sm text-ink-mute">{tempoRelativo(c.criadaEm)}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-ink">
        {nomeCurto(p.nome)}, <span className="tabular">{p.idade}</span> anos
      </p>
      <p className="text-sm text-ink-mute">{URGENCIA_LABEL[p.urgencia]}</p>
      <ul className="mt-4 divide-y divide-line border-y border-line text-base">
        {linhas.map((x) => (
          <li key={x.t} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-ink">{x.t}</span>
            {x.ok ? (
              <span className="flex items-center">
                <CircleCheck aria-hidden className="size-5 shrink-0 text-leaf-600" />
                <span className="sr-only">assegurado</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-alert-700">
                <CircleAlert aria-hidden className="size-4" /> não assegurado
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className={cn('mt-4 text-sm font-medium', tudo ? 'text-leaf-700' : 'text-sun-800')}>{tudo ? 'Compatível com a sua casa' : 'Compatibilidade parcial'}</p>
    </div>
  )
}

function ListaEspera({ lar }: { lar: Lar }) {
  const cands = useCandidaturasDoLar(lar.id)
  const lista = useMemo(
    () => cands.filter((c) => c.estado === 'lista_espera' && c.posicao != null).sort((a, b) => a.posicao! - b.posicao!).slice(0, 4),
    [cands],
  )
  if (!lista.length) return null
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">Lista de espera</span>
        <span className="text-ink-mute">{num(lar.listaEspera)} pessoas</span>
      </p>
      <ol className="mt-3 flex flex-col">
        {lista.map((c, i) => (
          <li key={c.id} className="flex items-center gap-3 border-t border-line py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-ink tabular">
              <span className="sr-only">Posição </span>
              {c.posicao}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">
              {nomeCurto(c.perfil.nome)} <span className="text-ink-mute">· {c.perfil.idade}<span className="hidden sm:inline"> anos</span></span>
            </span>
            {i === 0 ? (
              <span className="shrink-0 text-sm font-medium text-terra-600">Próxima</span>
            ) : (
              <span className="shrink-0 text-sm text-ink-mute">{c.perfil.quarto === 'indiferente' ? 'Qualquer' : QUARTO_CURTO[c.perfil.quarto]}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Ocupacao({ lar }: { lar: Lar }) {
  const meses = useMemo(() => previsaoMensal(lar, 6), [lar])
  const saidas = meses.reduce((s, d) => s + d.esperado, 0)
  const max = Math.max(...meses.map((m) => m.esperado), 0.1)
  const kpis = [
    { v: pct(taxaOcupacao(lar)), k: 'ocupação hoje' },
    { v: `≈ ${num(Math.round(saidas))}`, k: 'saídas em 6 meses' },
    { v: num(lar.listaEspera), k: 'em lista de espera' },
  ]
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <p className="text-sm font-semibold text-ink">Saídas previstas por mês</p>
      <ol className="mt-4 grid grid-cols-6 items-end gap-2 sm:gap-3">
        {meses.map((m) => (
          <li key={`${m.ano}-${m.mes}`} className="flex flex-col items-center gap-1.5">
            <span className="text-sm font-medium text-ink tabular">{fmt1(m.esperado)}</span>
            <span aria-hidden className="flex h-20 w-full items-end">
              <span className="w-full rounded-md bg-terra-200" style={{ height: `${Math.max(8, (m.esperado / max) * 100)}%` }} />
            </span>
            <span className="text-sm text-ink-mute">
              <span className="sr-only">{MESES_LONGOS[m.mes]}: </span>
              <span aria-hidden>{MESES_CURTOS[m.mes]}</span>
            </span>
          </li>
        ))}
      </ol>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        {kpis.map((x) => (
          <div key={x.k} className="flex flex-col-reverse gap-1">
            <dt className="text-sm leading-snug text-ink-mute">{x.k}</dt>
            <dd className="text-2xl font-semibold tracking-tight text-ink tabular sm:text-4xl">{x.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const fmt1 = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function Bento({ base, ensaio }: { base: Lar; ensaio: Ensaio }) {
  return (
    <section aria-labelledby="pl-funcoes" className="container-page py-24 sm:py-32 lg:py-40">
      <Reveal>
        <SectionTitle id="pl-funcoes" title="Feito para quem não tem tempo." subtitle="Quatro coisas. Bem feitas." />
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:mt-20 lg:grid-cols-12">
        <Tile title="Vagas num toque." text="Mais uma, menos uma. O cartão que as famílias veem muda no mesmo instante." className="lg:col-span-7">
          <VistaFamilia ensaio={ensaio} />
        </Tile>
        <Tile title="Pedidos com perfil clínico." text="Grau de dependência, cuidados e urgência, já comparados com a sua casa." className="lg:col-span-5" delay={80}>
          <Pedido lar={base} />
        </Tile>
        <Tile title="Lista de espera digital." text="Propõe a vaga e a família tem 48 horas para responder." plano="Plano Profissional" className="lg:col-span-5">
          <ListaEspera lar={base} />
        </Tile>
        <Tile
          title="Previsão de ocupação."
          text="Saiba quantos lugares deverão libertar-se e prepare as entradas com tempo."
          plano="Plano Profissional"
          className="lg:col-span-7"
          delay={80}
        >
          <Ocupacao lar={base} />
        </Tile>
      </div>
    </section>
  )
}
