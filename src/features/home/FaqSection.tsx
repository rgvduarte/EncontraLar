import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import type Lenis from 'lenis'
import { Reveal } from '@/components/ui/Reveal'
import { prefersReducedMotion } from '@/lib/motion'

function Mais({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="link inline-flex items-center gap-0.5 whitespace-nowrap">
      {children}
      <ChevronRight aria-hidden className="size-4" />
    </Link>
  )
}

const PERGUNTAS: { id: string; q: string; a: ReactNode }[] = [
  {
    id: 'faq-gratuito',
    q: 'É gratuito?',
    a: <>Sim, para as famílias é sempre gratuito: pesquisar, guardar, receber alertas e pedir vaga. O serviço é suportado pelas instituições que usam o painel de gestão.</>,
  },
  {
    id: 'faq-vaga-real',
    q: 'Como sabem que a vaga é real?',
    a: (
      <>
        É a própria instituição que indica as vagas, e cada ficha mostra quando foram confirmadas pela última vez. As fichas com selo
        Verificado foram visitadas pela nossa equipa, que confirmou a licença e as instalações.
      </>
    ),
  },
  {
    id: 'faq-previsao',
    q: 'A previsão é garantida?',
    a: (
      <>
        Não. É uma estimativa, como a previsão do tempo: usa as saídas dos últimos 12 meses, a lista de espera e a época do ano. Ajuda a
        planear, mas não substitui a conversa com a instituição. <Mais to="/sobre#previsao">Como calculamos</Mais>
      </>
    ),
  },
  {
    id: 'faq-ipss',
    q: 'Porque é que as IPSS têm preços diferentes?',
    a: (
      <>
        Nas IPSS e Misericórdias com acordo da Segurança Social, a mensalidade depende dos rendimentos da pessoa e do agregado. Por isso
        mostramos um intervalo. Nos privados, o preço é fixo por tipo de quarto. <Mais to="/guia#apoios">Apoios e comparticipações</Mais>
      </>
    ),
  },
  {
    id: 'faq-dados',
    q: 'E os dados de saúde?',
    a: (
      <>
        São dados sensíveis, protegidos pelo RGPD. Só seguem para uma instituição quando pede vaga nela, e pode apagá-los quando quiser.{' '}
        <Mais to="/privacidade">Privacidade</Mais>
      </>
    ),
  },
]

/**
 * Abre uma pergunta e leva-a ao ecrã (HashRouter: nada de href="#id").
 * Com o scroll suave ativo (Lenis) usa-o; caso contrário, scroll nativo.
 */
export function abrirPergunta(id: string, lenis?: Lenis | null) {
  const el = document.getElementById(id)
  if (!(el instanceof HTMLDetailsElement)) return
  el.open = true
  if (lenis) lenis.scrollTo(el, { offset: -160 })
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  el.querySelector('summary')?.focus({ preventScroll: true })
}

export function FaqSection() {
  return (
    <section aria-labelledby="faq-titulo" className="py-24 sm:py-32 lg:py-40">
      <Reveal className="container-page">
        <h2 id="faq-titulo" className="headline text-center">
          Perguntas frequentes.
        </h2>
      </Reveal>
      <div className="container-narrow max-w-3xl">
        <Reveal delay={100} className="mt-12 border-t border-line sm:mt-16">
          {PERGUNTAS.map((p) => (
            <details key={p.id} id={p.id} className="group border-b border-line">
              <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-6 py-5 text-xl font-semibold tracking-[-0.015em] text-ink sm:text-2xl [&::-webkit-details-marker]:hidden">
                {p.q}
                <Plus
                  aria-hidden
                  className="size-6 shrink-0 text-ink-mute transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)] group-open:rotate-45"
                />
              </summary>
              <p className="max-w-2xl pr-10 pb-7 text-lg text-ink-soft">{p.a}</p>
            </details>
          ))}
        </Reveal>
        <p className="mt-10 text-center">
          <Link to="/guia#faq" className="link inline-flex min-h-12 items-center gap-0.5 text-lg">
            Mais perguntas no guia
            <ChevronRight aria-hidden className="size-4.5" />
          </Link>
        </p>
      </div>
    </section>
  )
}
