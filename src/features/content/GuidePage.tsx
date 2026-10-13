import { useDocumentTitle } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Reveal, ScrollProgressBar } from '@/components/motion'
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

const PROGRESSO = 'Progresso de leitura do guia'

const ATALHOS: { label: string; to?: string; hash?: string }[] = [
  { label: 'Lares com vaga agora', to: '/pesquisa?vaga=agora' },
  { label: 'Ajuda-me a escolher', to: '/encontrar' },
  { label: 'Apoios e custos', hash: 'apoios' },
]

export default function GuidePage() {
  useDocumentTitle('Guia para famílias')
  const { goTo, pathname } = useAnchorNavigation(IDS)
  const active = useScrollSpy(IDS)
  const toc = { items: SECOES, active, onGo: goTo, pathname, label: 'Neste guia' }

  return (
    <>
      <ScrollProgressBar label={PROGRESSO} />
      {/* correção local: a barra partilhada combina a classe scale-x-0 (propriedade CSS `scale`) com o transform
          escrito em JS, por isso nunca aparece. Até ser corrigida no componente, anulamos a escala aqui. */}
      <style>{`@media (prefers-reduced-motion: no-preference) { [title="${PROGRESSO}"] > div { scale: none; } }`}</style>
      <PageHero
        eyebrow="Guia para famílias"
        title={
          <>
            Escolher um lar com calma, <em>mesmo com pressa</em>.
          </>
        }
        subtitle="O que é cada resposta, o que ver na visita, que apoios existem e a quem ligar. Gratuito e sem conta."
        className="print:hidden"
      >
        <p className="text-base text-ink-mute">Se tem pressa:</p>
        {/* telemóvel: lista agrupada com alvos grandes; desktop: ligações em linha */}
        <ul className="mx-auto mt-3 flex max-w-sm flex-col overflow-hidden rounded-[1.25rem] bg-sand text-left sm:hidden">
          {ATALHOS.map((a) => (
            <li key={a.label} className="border-t border-line-strong/50 first:border-t-0">
              <Link
                to={a.hash ? { pathname, hash: a.hash } : a.to!}
                onClick={
                  a.hash
                    ? (e) => {
                        e.preventDefault()
                        goTo(a.hash!)
                      }
                    : undefined
                }
                className="flex min-h-14 items-center justify-between gap-3 px-5 text-lg font-medium text-terra-700 active:bg-sand-deep"
              >
                {a.label}
                <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-1 hidden items-center justify-center gap-x-7 sm:flex">
          {ATALHOS.map((a) =>
            a.hash ? (
              <MoreLink key={a.label} to={{ pathname, hash: a.hash }} onClick={() => goTo(a.hash!)}>
                {a.label}
              </MoreLink>
            ) : (
              <MoreLink key={a.label} to={a.to!}>
                {a.label}
              </MoreLink>
            ),
          )}
        </div>
      </PageHero>

      <div className="container-page grid pb-20 sm:pb-32 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 xl:gap-24">
        <TocBar {...toc} />
        <TocSidebar {...toc} />
        <article aria-label="Guia para famílias" className="flex max-w-[46rem] min-w-0 flex-col gap-20 pt-10 sm:gap-32 lg:pt-0">
          <Tipos />
          <Escolher />
          <Visita />
          <Apoios />
          <Alerta />
          <Faq />
          <Linhas />
        </article>
      </div>

      <section aria-labelledby="guia-fecho" className="container-page print:hidden">
        <div className="flex flex-col items-center border-t border-line py-20 text-center sm:py-32">
          <Reveal variant="blur">
            <h2 id="guia-fecho" className="headline max-w-[16ch]">
              Pronto para o próximo passo?
            </h2>
          </Reveal>
          <Reveal variant="blur" delay={100}>
            <p className="mt-5 max-w-[40ch] text-xl text-ink-mute sm:text-2xl">Veja onde há vaga agora, perto de quem vai visitar.</p>
          </Reveal>
          <Reveal delay={200} className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-x-8 gap-y-2 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
            <ButtonLink to="/pesquisa?vaga=agora" size="lg" className="w-full sm:w-auto">
              Ver vagas no mapa
            </ButtonLink>
            <MoreLink to="/encontrar" className="justify-center text-lg">
              Ajuda-me a escolher
            </MoreLink>
          </Reveal>
        </div>
      </section>
    </>
  )
}
