import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { useDocumentTitle } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
import { AzulejoBand, CalcadaDivider, calcadaStonesBg } from '@/components/brand/patterns'
import { useAnchorNavigation, useScrollSpy } from './shared/anchors'
import { TocChips, TocSidebar, type TocItem } from './shared/Toc'
import { GuideHero } from './guia/GuideHero'
import { TiposSection } from './guia/TiposSection'
import { EscolherSection } from './guia/EscolherSection'
import { VisitChecklist } from './guia/VisitChecklist'
import { ApoiosSection } from './guia/ApoiosSection'
import { AlertaSection } from './guia/AlertaSection'
import { FaqSection, LinhasSection } from './guia/AjudaSections'

const SECOES: TocItem[] = [
  { id: 'tipos', label: 'Tipos de resposta', short: 'Tipos' },
  { id: 'escolher', label: 'Como escolher', short: 'Escolher' },
  { id: 'visita', label: 'A visita', short: 'Visita' },
  { id: 'apoios', label: 'Apoios e custos', short: 'Apoios' },
  { id: 'alerta', label: 'Sinais de alerta', short: 'Alerta' },
  { id: 'faq', label: 'Perguntas frequentes', short: 'Perguntas' },
  { id: 'linhas', label: 'Linhas de apoio', short: 'Linhas' },
]
const IDS = SECOES.map((s) => s.id)

export default function GuidePage() {
  useDocumentTitle('Guia para famílias')
  const { goTo, pathname } = useAnchorNavigation(IDS)
  const active = useScrollSpy(IDS)
  const artigo = useRef<HTMLElement>(null)
  const [minutos, setMinutos] = useState<number | null>(null)

  // tempo de leitura calculado a partir do texto real do guia (~200 palavras por minuto)
  useEffect(() => {
    const texto = artigo.current?.innerText ?? ''
    const palavras = texto.split(/\s+/).filter(Boolean).length
    if (palavras > 0) setMinutos(Math.max(1, Math.round(palavras / 200)))
  }, [])

  return (
    <>
      <GuideHero minutos={minutos} onGo={goTo} />
      <AzulejoBand color="#1d564e" opacity={0.5} size={40} className="h-10 opacity-60 print:hidden" />

      <div className="container-page">
        <TocChips items={SECOES} active={active} onGo={goTo} pathname={pathname} label="Secções do guia" />
        <div className="grid gap-12 pt-12 pb-24 sm:pt-16 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-20">
          <aside className="hidden lg:block">
            <TocSidebar
              items={SECOES}
              active={active}
              onGo={goTo}
              pathname={pathname}
              title="Neste guia"
              footer={
                <div className="flex flex-col gap-3 rounded-2xl bg-sand p-4 text-sm text-ink-soft">
                  <p>Já sabe o que procura?</p>
                  <ButtonLink to="/pesquisa?vaga=agora" size="sm" full icon={<Search aria-hidden className="size-4" />}>
                    Ver vagas no mapa
                  </ButtonLink>
                </div>
              }
            />
          </aside>
          <article ref={artigo} aria-labelledby="guia-titulo" className="flex min-w-0 flex-col gap-24 sm:gap-28">
            <TiposSection />
            <EscolherSection />
            <VisitChecklist />
            <ApoiosSection />
            <AlertaSection />
            <FaqSection />
            <LinhasSection />
          </article>
        </div>
      </div>

      {/* ——— Fecho: o próximo passo */}
      <section aria-labelledby="guia-fecho" className="on-dark relative bg-pine-900 text-pine-50 print:hidden">
        <CalcadaDivider color="#163a37" bg="#fbf8f3" height={26} className="absolute inset-x-0 -top-[25px]" />
        <div className="absolute inset-0" style={calcadaStonesBg('#ffffff', 0.035)} aria-hidden />
        <div className="relative container-page grid gap-8 py-16 sm:py-20 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <h2 id="guia-fecho" className="text-4xl font-semibold text-white sm:text-5xl">
              Pronto para o <em>próximo passo</em>?
            </h2>
            <p className="mt-4 max-w-[54ch] text-lg text-pine-200">
              Veja onde há vaga agora, perto de quem vai visitar — ou deixe-nos sugerir instituições compatíveis com o perfil de saúde da pessoa.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
            <ButtonLink to="/pesquisa?vaga=agora" variant="accent" size="lg" icon={<Search aria-hidden className="size-5" />}>
              Ver vagas no mapa
            </ButtonLink>
            <ButtonLink
              to="/encontrar"
              size="lg"
              variant="secondary"
              className="border-white/30! bg-transparent! text-white! hover:bg-white/10!"
              icon={<Sparkles aria-hidden className="size-5" />}
              iconRight={<ArrowRight aria-hidden className="size-5" />}
            >
              Ajuda-me a escolher
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
