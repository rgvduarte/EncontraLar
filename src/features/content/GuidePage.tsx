import { useDocumentTitle } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { useAnchorNavigation, useScrollSpy } from './shared/anchors'
import { TocBar, TocSidebar, type TocItem } from './shared/Toc'
import { MoreLink, PageHero } from './shared/ui'
import { Tipos } from './guia/Tipos'
import { Escolher } from './guia/Escolher'
import { Visita } from './guia/Visita'
import { Apoios } from './guia/Apoios'
import { Alerta } from './guia/Alerta'
import { Faq, Linhas } from './guia/Ajuda'

const SECOES: TocItem[] = [
  { id: 'tipos', label: 'Tipos de resposta' },
  { id: 'escolher', label: 'Como escolher' },
  { id: 'visita', label: 'A visita' },
  { id: 'apoios', label: 'Apoios e custos' },
  { id: 'alerta', label: 'Sinais de alerta' },
  { id: 'faq', label: 'Perguntas frequentes' },
  { id: 'linhas', label: 'Linhas de apoio' },
]
const IDS = SECOES.map((s) => s.id)

export default function GuidePage() {
  useDocumentTitle('Guia para famílias')
  const { goTo, pathname } = useAnchorNavigation(IDS)
  const active = useScrollSpy(IDS)
  const toc = { items: SECOES, active, onGo: goTo, pathname, label: 'Neste guia' }

  return (
    <>
      <PageHero
        eyebrow="Guia para famílias"
        title={
          <>
            Escolher um lar com calma, <em>mesmo com pressa</em>.
          </>
        }
        subtitle="O que é cada resposta, o que ver na visita, que apoios existem e a quem ligar."
        className="print:hidden"
      >
        <p className="text-base text-ink-mute">Se tem pressa:</p>
        <div className="mt-1 flex flex-col items-center gap-x-7 sm:flex-row sm:justify-center">
          <MoreLink to="/pesquisa?vaga=agora">Lares com vaga agora</MoreLink>
          <MoreLink to="/encontrar">Ajuda-me a escolher</MoreLink>
          <MoreLink to={{ pathname, hash: 'apoios' }} onClick={() => goTo('apoios')}>
            Apoios e custos
          </MoreLink>
        </div>
      </PageHero>

      <div className="container-page grid pb-24 sm:pb-32 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 xl:gap-24">
        <TocBar {...toc} />
        <TocSidebar {...toc} />
        <article aria-label="Guia para famílias" className="flex max-w-[46rem] min-w-0 flex-col gap-24 pt-12 sm:gap-32 lg:pt-0">
          <Tipos />
          <Escolher />
          <Visita />
          <Apoios />
          <Alerta />
          <Faq />
          <Linhas />
        </article>
      </div>

      <section aria-labelledby="guia-fecho" className="bg-sand print:hidden">
        <Reveal className="container-narrow flex flex-col items-center py-24 text-center sm:py-32">
          <h2 id="guia-fecho" className="headline max-w-[16ch]">
            Pronto para o próximo passo?
          </h2>
          <p className="mt-5 max-w-[40ch] text-xl text-ink-mute sm:text-2xl">Veja onde há vaga agora, perto de quem vai visitar.</p>
          <div className="mt-10 flex flex-col items-center gap-x-8 gap-y-3 sm:flex-row">
            <ButtonLink to="/pesquisa?vaga=agora" size="lg">
              Ver vagas no mapa
            </ButtonLink>
            <MoreLink to="/encontrar" className="text-lg">
              Ajuda-me a escolher
            </MoreLink>
          </div>
        </Reveal>
      </section>
    </>
  )
}
