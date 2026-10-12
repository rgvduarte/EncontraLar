/**
 * A resposta em três vetores — geolocalização, perfil clínico, transparência — cada um com UI real.
 */
import { useMemo, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, CircleMinus } from 'lucide-react'
import type { Lar } from '@/types'
import { useDB, useLares } from '@/lib/store'
import { vagasLivres } from '@/lib/forecast'
import { avaliarLar, type TipoRazao } from '@/lib/matching'
import { euro, num, tempoRelativo } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { DEMO_FAMILIA_ID } from '@/data/seed'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { VerifiedBadge } from '@/components/lar/badges'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'
import { SectionTitle } from '../shared/ui'

function Tile({
  title,
  text,
  children,
  className,
  delay = 0,
  centro,
}: {
  title: string
  text: string
  children: ReactNode
  className?: string
  delay?: number
  /** centra o conteúdo na vertical (em vez de o encostar ao fundo) */
  centro?: boolean
}) {
  return (
    <Reveal delay={delay} className={cn('flex flex-col rounded-[1.75rem] bg-sand p-7 sm:p-10', className)}>
      <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-[40ch] text-lg text-ink-mute">{text}</p>
      <div className={cn('mt-8 flex flex-1 flex-col', centro ? 'justify-center' : 'justify-end')}>{children}</div>
    </Reveal>
  )
}

function Mapa() {
  const lares = useLares()
  const comVaga = useMemo(() => lares.filter((l) => vagasLivres(l) > 0).length, [lares])
  return (
    <div className="flex flex-col gap-5">
      <PortugalMap lares={lares} className="mx-auto max-w-[19rem] sm:max-w-[26rem] lg:max-w-[32rem]" title={`Mapa de Portugal com ${num(lares.length)} instituições de demonstração`} />
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-base text-ink">
          <span className="font-semibold tabular">{num(lares.length)}</span> instituições ·{' '}
          <span className="font-semibold text-leaf-700 tabular">{num(comVaga)}</span> com vaga hoje
        </p>
        <MapLegend className="justify-center" />
      </div>
    </div>
  )
}

const ICONE: Record<TipoRazao, { Icon: typeof CircleCheck; cls: string; sr: string }> = {
  ok: { Icon: CircleCheck, cls: 'text-leaf-600', sr: 'cumpre' },
  parcial: { Icon: CircleMinus, cls: 'text-sun-700', sr: 'em parte' },
  falta: { Icon: CircleAlert, cls: 'text-alert-700', sr: 'não cumpre' },
}

function Compatibilidade({ lar }: { lar: Lar }) {
  const db = useDB()
  const perfil = useMemo(() => db.perfis.find((p) => p.userId === DEMO_FAMILIA_ID) ?? db.perfis[0], [db.perfis])
  const r = useMemo(() => (perfil ? avaliarLar(lar, perfil) : null), [lar, perfil])
  if (!perfil || !r) return null
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-semibold text-ink">{lar.nome}</p>
        <p className="shrink-0 text-sm font-semibold text-ink tabular">{r.score}%</p>
      </div>
      <p className="text-sm text-ink-mute">compatível com o perfil de uma pessoa com {perfil.idade} anos</p>
      <ul className="mt-4 flex flex-col border-t border-line">
        {r.razoes.slice(0, 5).map((x) => {
          const i = ICONE[x.tipo]
          return (
            <li key={x.texto} className="flex items-center gap-3 border-b border-line py-2.5 text-base text-ink last:border-b-0">
              <i.Icon aria-hidden className={cn('size-5 shrink-0', i.cls)} />
              <span className="sr-only">{i.sr}: </span>
              {x.texto}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Transparencia({ lar }: { lar: Lar }) {
  return (
    <div className="rounded-[1.25rem] bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 font-semibold text-ink">{lar.nome}</p>
        <VerifiedBadge lar={lar} />
      </div>
      <dl className="mt-4 flex flex-col border-t border-line text-base">
        {lar.quartos.map((q) => (
          <div key={q.tipo} className="flex items-baseline justify-between gap-3 border-b border-line py-2.5">
            <dt className="text-ink-soft">{QUARTO_LABEL[q.tipo].replace(' (partilhado)', '')}</dt>
            <dd className="font-semibold whitespace-nowrap text-ink tabular">desde {euro(q.precoMin)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-b border-line py-2.5">
          <dt className="text-ink-soft">Vagas atualizadas</dt>
          <dd className="text-ink">{tempoRelativo(lar.atualizadoEm)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-2.5">
          <dt className="text-ink-soft">Licença</dt>
          <dd className="text-ink tabular">n.º {lar.verificacao.licenca}</dd>
        </div>
      </dl>
    </div>
  )
}

export function Vetores({ lar }: { lar: Lar }) {
  return (
    <section aria-labelledby="sobre-resposta" className="container-page py-24 sm:py-32 lg:py-40">
      <Reveal>
        <SectionTitle id="sobre-resposta" title="A resposta, em três ideias." subtitle="O que muda quando a informação está num só sítio." />
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:mt-20 lg:grid-cols-2">
        <Tile title="Geolocalização." text="Vagas perto de quem vai visitar, num mapa que as próprias instituições atualizam." className="lg:row-span-2" centro>
          <Mapa />
        </Tile>
        <Tile title="Perfil clínico." text="Dizemos que casas tratam o que a pessoa precisa, e porquê." delay={80}>
          <Compatibilidade lar={lar} />
        </Tile>
        <Tile title="Transparência." text="Preço por quarto, data da última atualização e licença, sempre à vista." delay={80}>
          <Transparencia lar={lar} />
        </Tile>
      </div>
    </section>
  )
}
