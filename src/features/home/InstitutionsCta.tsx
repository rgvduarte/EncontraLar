import { ButtonLink } from '@/components/ui/Button'
import { ScrollZoom } from '@/components/motion/ScrollZoom'
import { Reveal } from './Entrada'

/**
 * Bloco preto para as instituições. Entra com o "zoom de produto" (cresce e arredonda menos com o scroll);
 * as linhas do título sobem uma a uma. No telemóvel, o botão ocupa a largura toda (alcance do polegar).
 */
export function InstitutionsCta() {
  return (
    <section aria-labelledby="cta-lares-titulo" className="container-page pt-4 sm:pt-8">
      <ScrollZoom from={0.88} radiusFrom={64} radiusTo={28} className="on-dark bg-pine-950">
        <div className="px-6 py-20 text-center text-white sm:px-16 sm:py-28 lg:py-36">
          <h2 id="cta-lares-titulo" className="mx-auto max-w-5xl text-[2.5rem] leading-[1.06] font-semibold text-white sm:text-5xl lg:text-6xl">
            <Reveal as="span" variant="blur" className="block text-pine-400">
              Gere um lar?
            </Reveal>
            <Reveal as="span" variant="blur" delay={120} className="block">
              Preencha vagas <em className="sm:whitespace-nowrap">mais depressa.</em>
            </Reveal>
          </h2>
          <Reveal delay={240}>
            <p className="mx-auto mt-6 max-w-xl text-xl text-pine-300">
              Atualize as vagas num toque e receba pedidos de famílias com o perfil de quem precisa.
            </p>
          </Reveal>
          <Reveal delay={340} className="mx-auto mt-10 max-w-sm sm:max-w-none">
            <ButtonLink to="/para-lares" variant="inverse" size="lg" className="w-full sm:w-auto">
              Saber mais
            </ButtonLink>
          </Reveal>
        </div>
      </ScrollZoom>
    </section>
  )
}
