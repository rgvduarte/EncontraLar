/**
 * Cinco funcionalidades em grelha "bento": título curto, uma frase e um pedaço de UI real.
 * Os pedidos respeitam a privacidade em duas fases (RGPD art. 9.º): numa página pública, e antes de a
 * instituição aceitar, nunca aparece o nome nem o contacto — só o resumo sem identificação.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Clock, Lock } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { useCandidaturasDoLar } from '@/lib/store'
import { diasAteAlta, faixaEtaria, origemDe, prioridadePedido } from '@/lib/negocio'
import { previsaoMensal, taxaOcupacao } from '@/lib/forecast'
import { MESES_CURTOS, MESES_LONGOS, num, pct, tempoRelativo } from '@/lib/format'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO, URGENCIA_LABEL } from '@/lib/labels'
import { LarCard } from '@/components/lar/LarCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { MoreLink, SectionTitle, SWIPE_ITEM, SwipeRow } from '../shared/ui'
import { nomeCurto, type Ensaio } from './ensaio'
import { Stepper } from './ProductShot'

/**
 * Um tile do bento. Entra a subir; a peça de interface "monta-se" logo a seguir (escala suave).
 * No telemóvel é um cartão de uma faixa deslizável. `lado`: no desktop, texto à esquerda e interface à direita
 * (para o tile que ocupa a largura toda).
 */
function Tile({
  title,
  text,
  extra,
  children,
  className,
  delay = 0,
  lado = false,
}: {
  title: string
  text: string
  extra?: ReactNode
  children: ReactNode
  className?: string
  delay?: number
  lado?: boolean
}) {
  return (
    <Reveal
      as="li"
      delay={delay}
      className={cn(
        SWIPE_ITEM,
        'flex w-[88%] flex-col rounded-[1.75rem] bg-sand p-5 sm:p-10 md:w-auto',
        lado && 'lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16',
        className,
      )}
    >
      <div>
        <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-[40ch] text-lg text-ink-mute">{text}</p>
        {extra}
      </div>
      <Reveal variant="scale" delay={delay + 220} duration={1100} className={cn('mt-8 flex flex-1 flex-col justify-end', lado && 'lg:mt-0')}>
        {children}
      </Reveal>
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

/** Um pedido de família ainda por aceitar (os encaminhamentos têm o seu próprio tile). */
function escolherPedido(cands: Candidatura[]): Candidatura | undefined {
  const familias = cands.filter((c) => origemDe(c) === 'familia')
  return (
    familias.find((c) => c.estado === 'enviada' && c.perfil.necessidades.length > 0) ??
    familias.find((c) => c.estado === 'enviada') ??
    familias.find((c) => c.estado === 'em_analise') ??
    familias[0]
  )
}

/**
 * Pedido em duas fases, em modo de ensaio (nada é gravado): primeiro só o perfil de cuidados, sem nome nem
 * contacto; "Aceitar e ver contacto" mostra quem é e como contactar. O foco acompanha o botão que muda.
 */
function PedidoDuasFases({ lar }: { lar: Lar }) {
  const cands = useCandidaturasDoLar(lar.id)
  const c = useMemo(() => escolherPedido(cands), [cands])
  const [aceite, setAceite] = useState(false)
  const mexeu = useRef(false)
  const aceitar = useRef<HTMLButtonElement>(null)
  const voltar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mexeu.current) return
    ;(aceite ? voltar : aceitar).current?.focus()
  }, [aceite])

  if (!c) return null
  const p = c.perfil
  const linhas = [
    { t: GRAU_LABEL[p.grau], ok: lar.graus.includes(p.grau) },
    ...p.necessidades.map((n) => ({ t: CUIDADO_LABEL[n], ok: lar.cuidados.includes(n) })),
  ]
  const tudo = linhas.every((x) => x.ok)
  const mudar = (v: boolean) => {
    mexeu.current = true
    setAceite(v)
  }

  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-terra-600">{aceite ? 'Pedido aceite' : 'Novo pedido'}</p>
        <p className="text-sm text-ink-mute">{tempoRelativo(c.criadaEm)}</p>
      </div>
      <div aria-live="polite">
        {aceite ? (
          <>
            <p className="mt-2 text-xl font-semibold text-ink">
              {nomeCurto(p.nome)}, <span className="tabular">{p.idade}</span> anos
            </p>
            <p className="text-sm text-ink-mute">
              Contacto: {nomeCurto(c.contacto.nome)}
              {c.contacto.telefone && (
                <>
                  {' '}
                  · <span className="tabular">{c.contacto.telefone}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-xl font-semibold text-ink">
              Pessoa de <span className="tabular">{faixaEtaria(p.idade)}</span> anos
            </p>
            <p className="text-sm text-ink-mute">
              {p.local.label} · {URGENCIA_LABEL[p.urgencia]}
            </p>
          </>
        )}
      </div>
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
      {aceite ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-ink-mute">A família é avisada de que aceitou.</p>
          <button
            ref={voltar}
            type="button"
            onClick={() => mudar(false)}
            className="-my-2 min-h-11 text-sm font-medium text-terra-700 hover:underline underline-offset-4"
          >
            Voltar ao resumo
          </button>
        </div>
      ) : (
        <Button ref={aceitar} variant="primary" className="mt-4 w-full" icon={<Lock aria-hidden strokeWidth={1.75} />} onClick={() => mudar(true)}>
          Aceitar e ver contacto
        </Button>
      )}
    </div>
  )
}

/** Urgência curta para a linha da caixa de pedidos. */
const URGENCIA_CURTA: Record<Candidatura['perfil']['urgencia'], string> = {
  imediata: 'Urgente',
  '1-3meses': '1 a 3 meses',
  '3-6meses': '3 a 6 meses',
  planeamento: 'Sem pressa',
}

/** "Alta em 4 dias" · "Alta amanhã" · "Alta hoje" (o texto comum do painel). */
function textoAlta(dias: number): string {
  if (dias === 0) return 'Alta hoje'
  if (dias === 1) return 'Alta amanhã'
  return `Alta em ${dias} dias`
}

/**
 * A caixa de pedidos da instituição: os encaminhamentos com alta nos próximos 7 dias à frente (prioridadePedido).
 * Numa página pública, todas as linhas ficam sem identificação.
 */
function Encaminhamentos({ lar }: { lar: Lar }) {
  const cands = useCandidaturasDoLar(lar.id)
  const lista = useMemo(
    () =>
      cands
        .filter((c) => c.estado === 'enviada' || c.estado === 'em_analise')
        .map((c, i) => ({ c, i, prio: prioridadePedido(c) }))
        .sort((a, b) => a.prio - b.prio || a.i - b.i)
        .slice(0, 3)
        .map(({ c }) => c),
    [cands],
  )
  if (!lista.some((c) => origemDe(c) === 'profissional')) return null
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">Pedidos por responder</span>
        <span className="text-ink-mute">por prioridade</span>
      </p>
      <ol className="mt-3 flex flex-col">
        {lista.map((c, i) => {
          const dias = diasAteAlta(c.encaminhamento?.altaPrevista)
          const encaminhado = origemDe(c) === 'profissional' && c.encaminhamento
          return (
            // no telemóvel e no tablet bastam duas linhas (o cartão vive numa faixa estreita)
            <li key={c.id} className={cn('border-t border-line py-3.5', i > 1 && 'hidden lg:block')}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-ink">
                  Pessoa de <span className="tabular">{faixaEtaria(c.perfil.idade)}</span> anos
                </p>
                {dias != null && dias >= 0 ? (
                  <Badge tone={dias <= 7 ? 'alert' : 'neutral'} icon={<Clock aria-hidden strokeWidth={2} />}>
                    {textoAlta(dias)}
                  </Badge>
                ) : (
                  <span className="shrink-0 text-sm text-ink-mute">{URGENCIA_CURTA[c.perfil.urgencia]}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-ink-mute">
                {GRAU_LABEL[c.perfil.grau]} · {encaminhado ? `Encaminhado por ${c.encaminhamento!.organizacao}` : 'Pedido de uma família'}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="mt-1 border-t border-line pt-4 text-sm text-ink-mute">
        As altas dos próximos 7 dias sobem ao topo da sua lista. A ordem pública dos resultados não muda.
      </p>
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
    <section aria-labelledby="pl-funcoes" className="container-page py-20 sm:py-32 lg:py-40">
      <Reveal variant="blur">
        <SectionTitle id="pl-funcoes" title="Feito para quem não tem tempo." subtitle="Cinco coisas, bem feitas. Incluídas para todas as instituições." />
      </Reveal>
      <SwipeRow as="ul" label="Funcionalidades" className="mt-12 sm:mt-20 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-12">
        <Tile
          title="Vagas num toque."
          text="Mais uma, menos uma. O cartão que as famílias veem muda no mesmo instante."
          className="md:col-span-2 lg:col-span-12"
          lado
        >
          <VistaFamilia ensaio={ensaio} />
        </Tile>
        <Tile title="Pedidos com perfil de cuidados." text="Vê primeiro o perfil de cuidados, sem dados pessoais. Aceita, e só então recebe o contacto." className="lg:col-span-5">
          <PedidoDuasFases lar={base} />
        </Tile>
        <Tile
          title="Encaminhamentos de hospitais."
          text="Hospitais e centros de saúde enviam-lhe pedidos com a data prevista de alta."
          extra={
            <MoreLink to="/profissionais" tone="sand" className="mt-2 text-lg">
              Para profissionais de saúde
            </MoreLink>
          }
          className="lg:col-span-7"
          delay={100}
        >
          <Encaminhamentos lar={base} />
        </Tile>
        <Tile title="Lista de espera digital." text="Propõe a vaga e a família tem 48 horas para responder." className="lg:col-span-5">
          <ListaEspera lar={base} />
        </Tile>
        <Tile
          title="Previsão de ocupação."
          text="Saiba quantos lugares deverão libertar-se e prepare as entradas com tempo."
          className="lg:col-span-7"
          delay={100}
        >
          <Ocupacao lar={base} />
        </Tile>
      </SwipeRow>
    </section>
  )
}
