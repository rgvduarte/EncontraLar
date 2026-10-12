import { forwardRef } from 'react'
import { MapPin } from 'lucide-react'
import type { Role, User } from '@/types'
import { AzulejoBand, calcadaStonesBg } from '@/components/brand/patterns'
import { LarCover } from '@/components/lar/LarCover'
import { VerifiedBadge } from '@/components/lar/badges'
import { Avatar } from '@/components/ui/misc'
import { DEMO_FAMILIA_EMAIL, DEMO_FAMILIA_ID, DEMO_LAR_EMAIL, DEMO_LAR_USER_ID, DEMO_PASSWORD } from '@/data/seed'
import { painelPath } from '@/components/layout/Header'
import { DemoCard, type DemoCardState } from './DemoCard'
import { useDemoPersonas } from './useDemoPersonas'
import { comPreposicao } from '../shared/lugar'

/**
 * Painel escuro "Experimente sem criar conta": duas contas fictícias com dados reais do protótipo.
 * Moldura de azulejo no topo e textura de calçada no fundo.
 */
export const DemoAccountsPanel = forwardRef<HTMLHeadingElement, {
  user: User | null
  loading: Role | null
  onEnter: (role: Role) => void
}>(function DemoAccountsPanel({ user, loading, onEnter }, headingRef) {
  const { familia, lar } = useDemoPersonas()

  const stateFor = (role: Role, userId: string): DemoCardState => {
    if (user?.id === userId) return 'current'
    if (loading === role) return 'loading'
    if (loading) return 'disabled'
    return 'idle'
  }
  const trocar = user != null

  return (
    <section
      id="demo"
      aria-labelledby="demo-titulo"
      className="on-dark relative isolate -mx-4 overflow-hidden bg-pine-900 text-pine-50 shadow-lift sm:mx-0 sm:rounded-[2rem]"
    >
      <AzulejoBand color="#afd6cb" opacity={0.55} size={44} className="h-11 border-b border-white/10 bg-pine-800" />
      <div className="relative px-4 pt-7 pb-8 sm:px-8 sm:pt-9 sm:pb-8" style={calcadaStonesBg('#ffffff', 0.04)}>
        <div className="max-w-xl">
          <p className="text-xs font-bold tracking-[0.14em] text-sun-200 uppercase">Contas de demonstração</p>
          <h2
            id="demo-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 font-display text-3xl font-semibold text-white outline-none sm:text-4xl"
          >
            Experimente <em>sem</em> criar conta
          </h2>
          <p className="mt-3 text-lg text-pine-100">
            Duas contas fictícias, já com pedidos, uma lista de espera em curso e alertas de vaga. Um clique e está dentro.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-5">
          {familia && (
            <DemoCard
              media={<Avatar nome={familia.nome} className="size-14 text-lg" />}
              kicker="Família"
              nome={familia.nome}
              subtitulo={
                familia.local && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                    <MapPin aria-hidden className="size-4 text-terra-600" /> Procura {comPreposicao('em', familia.local)}
                  </span>
                )
              }
              historia={familia.historia}
              rows={familia.rows}
              entrarLabel={trocar ? 'Mudar para a conta da Ana' : 'Entrar como Ana'}
              email={DEMO_FAMILIA_EMAIL}
              password={DEMO_PASSWORD}
              state={stateFor('familia', DEMO_FAMILIA_ID)}
              painel={painelPath('familia')}
              onEnter={() => onEnter('familia')}
            />
          )}
          {lar && (
            <DemoCard
              media={
                <span className="block size-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-line">
                  <LarCover hue={lar.lar.capa.hue} variante={lar.lar.capa.variante} />
                </span>
              }
              kicker="Instituição"
              nome={lar.lar.nome}
              subtitulo={
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <span>Gerida por {lar.responsavel}</span>
                  <VerifiedBadge lar={lar.lar} />
                </span>
              }
              historia={lar.historia}
              rows={lar.rows}
              entrarLabel={trocar ? 'Mudar para a conta da instituição' : 'Entrar como instituição'}
              email={DEMO_LAR_EMAIL}
              password={DEMO_PASSWORD}
              state={stateFor('lar', DEMO_LAR_USER_ID)}
              painel={painelPath('lar')}
              onEnter={() => onEnter('lar')}
            />
          )}
          {!familia && !lar && (
            <p className="rounded-2xl border border-white/15 bg-white/5 p-5 text-pine-100">
              As contas de demonstração não estão disponíveis neste navegador. Use «Repor demonstração», no rodapé, para as recuperar.
            </p>
          )}
        </div>

        <p className="mt-6 max-w-xl text-sm text-pine-200">
          Pessoas e instituições fictícias. Tudo o que fizer fica só neste navegador — pode voltar ao início com «Repor demonstração», no rodapé.
        </p>
      </div>
    </section>
  )
})
