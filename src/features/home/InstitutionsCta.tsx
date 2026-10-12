import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Reveal } from '@/components/ui/Reveal'

/** Bloco preto para as instituições — o único momento escuro da página. */
export function InstitutionsCta() {
  return (
    <section aria-labelledby="cta-lares-titulo" className="container-page">
      <Reveal className="on-dark rounded-[1.75rem] bg-pine-950 px-6 py-20 text-center text-white sm:px-16 sm:py-28 lg:py-36">
        <h2 id="cta-lares-titulo" className="mx-auto max-w-5xl text-[2.5rem] leading-[1.06] font-semibold text-white sm:text-5xl lg:text-6xl">
          <span className="text-pine-400">Gere um lar?</span>
          <br />
          Preencha vagas <em className="sm:whitespace-nowrap">mais depressa.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-xl text-pine-300">
          Atualize as vagas num toque e receba pedidos de famílias com o perfil de quem precisa.
        </p>
        <Link
          to="/para-lares"
          className="mt-6 inline-flex min-h-12 items-center gap-0.5 text-lg font-medium text-terra-300 underline-offset-4 hover:underline"
        >
          Saber mais
          <ChevronRight aria-hidden className="size-4.5" />
        </Link>
      </Reveal>
    </section>
  )
}
