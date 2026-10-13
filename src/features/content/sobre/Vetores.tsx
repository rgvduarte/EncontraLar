/**
 * A resposta em três vetores — geolocalização, perfil clínico, transparência — cada um com UI real.
 * Na versão grátis, a interface é a da versão grátis: contagens agregadas no mapa, só as razões clínicas
 * e a faixa de preço (o preço de cada quarto é do Acesso Família). A instituição de exemplo vem anónima
 * (useExampleLar).
 */
import { useMemo, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, CircleMinus, Lock } from 'lucide-react'
import type { Lar } from '@/types'
import { useAcesso, useDB, useLares } from '@/lib/store'
import { faixaPreco, resumoDisponibilidade } from '@/lib/acesso'
import { niveisVerificacao } from '@/lib/negocio'
import { avaliarLar, type TipoRazao } from '@/lib/matching'
import { ACESSO_DISPONIVEL } from '@/components/acesso'
import { euro, num, tempoRelativo } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { DEMO_FAMILIA_ID } from '@/data/seed'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { MapaNeutro } from '@/features/home/MapaNeutro'
import { VerifiedBadge } from '@/components/lar/badges'
import { CountUp, Reveal, ScrollZoom } from '@/components/motion'
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
    <Reveal delay={delay} className={cn('flex flex-col rounded-[1.75rem] bg-sand p-6 sm:p-10', className)}>
      <h3 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h3>
      <p className="mt-3 max-w-[40ch] text-lg text-ink-mute">{text}</p>
      <div className={cn('mt-8 flex flex-1 flex-col', centro ? 'justify-center' : 'justify-end')}>{children}</div>
    </Reveal>
  )
}

/**
 * Com o Acesso Família, cada ponto tem a cor da sua disponibilidade. Na versão grátis, os pontos são todos iguais
 * (MapaNeutro, o mesmo da página inicial) e só o total diz quantas têm vaga: o quantas, nunca o quais.
 */
function Mapa({ completo }: { completo: boolean }) {
  const lares = useLares()
  // o mesmo total agregado do resto do site ("com vaga agora" = vaga para quem pede hoje)
  const comVaga = useMemo(() => resumoDisponibilidade(lares).comVaga, [lares])
  const titulo = `Mapa de Portugal com ${num(lares.length)} instituições de demonstração`
  const tamanho = 'mx-auto max-w-[19rem] sm:max-w-[26rem] lg:max-w-[32rem]'
  return (
    <div className="flex flex-col gap-5">
      {/* o mapa (SVG com centenas de pontos) entra com uma escala única; ligado ao scroll, obrigaria a
          re-rasterizar o SVG em cada frame */}
      <Reveal variant="scale" duration={1200}>
        {completo ? (
          <PortugalMap lares={lares} className={tamanho} title={titulo} />
        ) : (
          <MapaNeutro lares={lares} className={tamanho} title={titulo} />
        )}
      </Reveal>
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-base text-ink">
          <CountUp value={lares.length} className="font-semibold tabular" /> instituições ·{' '}
          <CountUp value={comVaga} className="font-semibold text-leaf-700 tabular" /> com vaga agora
        </p>
        {completo && <MapLegend className="justify-center" />}
      </div>
    </div>
  )
}

const ICONE: Record<TipoRazao, { Icon: typeof CircleCheck; cls: string; sr: string }> = {
  ok: { Icon: CircleCheck, cls: 'text-leaf-600', sr: 'cumpre' },
  parcial: { Icon: CircleMinus, cls: 'text-sun-700', sr: 'em parte' },
  falta: { Icon: CircleAlert, cls: 'text-alert-700', sr: 'não cumpre' },
}

/** Razões que vêm da camada viva (preço por quarto, vaga, espera): na versão grátis, ficam de fora. */
const RAZAO_VIVA = /€|vaga|lista de espera|lugar livre/i

function Compatibilidade({ lar, completo }: { lar: Lar; completo: boolean }) {
  const db = useDB()
  const perfil = useMemo(() => db.perfis.find((p) => p.userId === DEMO_FAMILIA_ID) ?? db.perfis[0], [db.perfis])
  const r = useMemo(() => (perfil ? avaliarLar(lar, perfil) : null), [lar, perfil])
  if (!perfil || !r) return null
  const razoes = completo ? r.razoes : r.razoes.filter((x) => !RAZAO_VIVA.test(x.texto))
  return (
    <ScrollZoom from={0.86} radiusFrom={40} radiusTo={20} className="bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-semibold text-ink">{lar.nome}</p>
        <p className="shrink-0 text-sm font-semibold text-ink tabular">
          <CountUp value={r.score} />%
        </p>
      </div>
      <p className="text-sm text-ink-mute">compatível com o perfil de uma pessoa com {perfil.idade} anos</p>
      <ul className="mt-4 flex flex-col border-t border-line">
        {razoes.slice(0, 5).map((x) => {
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
    </ScrollZoom>
  )
}

/**
 * A ficha, em resumo. Com o Acesso Família: preço por quarto, última atualização das vagas e n.º da licença.
 * Na versão grátis: o que a versão grátis mostra (faixa de preço e licença confirmada) e o preço por quarto fechado,
 * sem valores no DOM; o n.º da licença também fica de fora, para o exemplo continuar anónimo.
 */
function Transparencia({ lar, completo }: { lar: Lar; completo: boolean }) {
  const linha = 'flex items-baseline justify-between gap-3 border-b border-line py-2.5'
  return (
    <ScrollZoom from={0.86} radiusFrom={40} radiusTo={20} className="bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 font-semibold text-ink">{lar.nome}</p>
        <VerifiedBadge lar={lar} />
      </div>
      <dl className="mt-4 flex flex-col border-t border-line text-base">
        {completo ? (
          <>
            {lar.quartos.map((q) => (
              <div key={q.tipo} className={linha}>
                <dt className="text-ink-soft">{QUARTO_LABEL[q.tipo].replace(' (partilhado)', '')}</dt>
                <dd className="font-semibold whitespace-nowrap text-ink tabular">desde {euro(q.precoMin)}</dd>
              </div>
            ))}
            <div className={linha}>
              <dt className="text-ink-soft">Vagas atualizadas</dt>
              <dd className="text-ink">{tempoRelativo(lar.atualizadoEm)}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line py-2.5">
              <dt className="text-ink-soft">Mensalidade</dt>
              {/* numa linha só (o € nunca fica sozinho); se não couber ao lado, desce inteira */}
              <dd className="ml-auto font-semibold whitespace-nowrap text-ink tabular">{faixaPreco(lar).replace(/ €/g, '\u00a0€')}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line py-2.5">
              <dt className="text-ink-soft">Preço por quarto</dt>
              <dd className="flex items-center gap-1.5 text-sm text-ink-mute">
                <Lock aria-hidden className="size-3.5 shrink-0" />
                {ACESSO_DISPONIVEL}
              </dd>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between gap-3 pt-2.5">
          <dt className="text-ink-soft">Licença</dt>
          {completo ? (
            <dd className="text-ink tabular">n.º {lar.verificacao.licenca}</dd>
          ) : (
            <dd className="text-ink">{niveisVerificacao(lar).licenca ? 'Confirmada' : 'Por confirmar'}</dd>
          )}
        </div>
      </dl>
    </ScrollZoom>
  )
}

export function Vetores({ lar }: { lar: Lar }) {
  const { completo } = useAcesso()
  return (
    <section aria-labelledby="sobre-resposta" className="container-page py-20 sm:py-32 lg:py-40">
      <Reveal variant="blur">
        <SectionTitle id="sobre-resposta" title="A resposta, em três ideias." subtitle="O que muda quando a informação está num só sítio." />
      </Reveal>
      <div className="mt-14 grid grid-cols-1 gap-4 sm:mt-20 lg:grid-cols-2">
        <Tile title="Geolocalização." text="Vagas perto de quem vai visitar, num mapa que as próprias instituições atualizam." className="lg:row-span-2" centro>
          <Mapa completo={completo} />
        </Tile>
        <Tile title="Perfil clínico." text="Dizemos que casas tratam o que a pessoa precisa, e porquê." delay={100}>
          <Compatibilidade lar={lar} completo={completo} />
        </Tile>
        <Tile
          title="Transparência."
          text={
            completo
              ? 'Preço por quarto, data da última atualização e licença, sempre à vista.'
              : 'Faixa de preço, verificação e licença, sempre à vista. O preço de cada quarto, com o Acesso Família.'
          }
          delay={100}
        >
          <Transparencia lar={lar} completo={completo} />
        </Tile>
      </div>
    </section>
  )
}
