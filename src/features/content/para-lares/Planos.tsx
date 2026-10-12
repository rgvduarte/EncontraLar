/**
 * Planos em três colunas limpas. Preços indicativos do protótipo, assinalados como tal.
 */
import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { euro } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { SectionTitle, SWIPE_ITEM_LG, SwipeRow } from '../shared/ui'

const PRECO_PROFISSIONAL = 39

const PLANOS = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 'Gratuito',
    para: 'Para estar no mapa e receber pedidos.',
    cta: { label: 'Começar', to: '/registar?tipo=lar' },
    base: null,
    inclui: ['Ficha completa da instituição', 'Vagas em tempo real no mapa', 'Pedidos com perfil clínico', 'Aviso às famílias que seguem a casa', 'Selo de verificação'],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: `${PRECO_PROFISSIONAL} €`,
    periodo: '/mês',
    para: 'Para preencher vagas mais depressa.',
    cta: { label: 'Experimentar', to: '/registar?tipo=lar&plano=profissional' },
    base: 'Essencial',
    inclui: ['Lista de espera digital', 'Previsão de ocupação', 'Destaque assinalado na sua zona', 'Estatísticas da ficha'],
  },
  {
    id: 'rede',
    nome: 'Rede',
    preco: 'Sob consulta',
    para: 'Para Misericórdias, IPSS e grupos com várias casas.',
    cta: { label: 'Pedir proposta', to: '/registar?tipo=lar&plano=rede' },
    base: 'Profissional',
    inclui: ['Várias casas numa só conta', 'Painel consolidado', 'Acompanhamento dedicado'],
  },
] as const

/** Uma semana com o quarto mais barato vazio vs. o custo mensal do plano. */
function Contas({ lar }: { lar: Lar }) {
  const q = [...lar.quartos].sort((a, b) => a.precoMin - b.precoMin)[0]
  if (!q) return null
  const semana = (q.precoMin / 30) * 7
  const meses = Math.floor(semana / PRECO_PROFISSIONAL)
  if (meses < 2) return null
  return (
    <p className="mx-auto mt-12 max-w-[52ch] text-center text-lg text-ink-mute sm:mt-16">
      Na {lar.nome}, uma semana com um {QUARTO_LABEL[q.tipo].replace(' (partilhado)', '').toLowerCase()} vazio são cerca de{' '}
      <span className="font-semibold text-ink tabular">{euro(semana)}</span>. Mais do que {meses} meses do plano Profissional.
    </p>
  )
}

export function Planos({ lar }: { lar: Lar }) {
  return (
    <section aria-labelledby="pl-planos" className="container-page py-20 sm:py-32 lg:py-40">
      <Reveal variant="blur">
        <SectionTitle
          id="pl-planos"
          title={
            <>
              Estar no mapa é <em>gratuito</em>.
            </>
          }
          subtitle="Paga só quem quer gerir a lista de espera e planear entradas."
        />
        <p className="mt-5 text-center text-sm text-ink-mute">Preços indicativos (protótipo), por instituição.</p>
      </Reveal>

      {/* telemóvel: faixa deslizável (o plano seguinte espreita); desktop: três colunas que entram em cascata */}
      <SwipeRow as="ul" label="Planos" ate="lg" className="mt-12 max-w-5xl sm:mt-20 lg:mx-auto lg:grid lg:grid-cols-3 lg:gap-4">
        {PLANOS.map((p, i) => {
          const destaque = p.id === 'profissional'
          return (
            <Reveal
              as="li"
              key={p.id}
              delay={i * 120}
              className={cn(SWIPE_ITEM_LG, 'flex flex-col rounded-[1.75rem] p-6 sm:p-8', destaque ? 'bg-sand' : 'bg-white ring-1 ring-line ring-inset')}
            >
              <p className="flex items-center justify-between gap-3">
                <span className="text-xl font-semibold text-ink">{p.nome}</span>
                {destaque && <span className="text-sm font-medium text-terra-700">Recomendado</span>}
              </p>
              <p className="mt-6 flex h-16 items-end gap-1 font-semibold tracking-tight text-ink tabular">
                <span className={cn('leading-none', p.id === 'rede' ? 'text-3xl' : 'text-4xl sm:text-5xl')}>{p.preco}</span>
                {'periodo' in p && <span className="text-lg leading-none font-normal tracking-normal text-ink-mute">{p.periodo}</span>}
              </p>
              <p className="mt-3 min-h-14 text-base text-ink-mute">{p.para}</p>
              <ButtonLink to={p.cta.to} variant={destaque ? 'primary' : 'subtle'} full className="mt-6">
                {p.cta.label}
                <span className="sr-only"> — plano {p.nome}</span>
              </ButtonLink>
              <div className="mt-8 border-t border-line pt-6">
                {p.base && <p className="mb-3 text-sm text-ink-mute">Tudo do {p.base}, e ainda:</p>}
                <ul className="flex flex-col gap-2.5">
                  {p.inclui.map((f) => (
                    <li key={f} className="flex gap-2.5 text-base text-ink">
                      <Check aria-hidden strokeWidth={2} className="mt-1 size-4 shrink-0 text-ink-mute" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )
        })}
      </SwipeRow>

      <Reveal variant="fade" delay={150}>
        <Contas lar={lar} />
      </Reveal>
    </section>
  )
}
