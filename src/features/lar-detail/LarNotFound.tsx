import { ArrowRight, Map as MapIcon } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { LarCover } from '@/components/lar/LarCover'
import { AzulejoBand } from '@/components/brand/patterns'
import { useDocumentTitle } from '@/lib/hooks'

/** A instituição pedida não existe (link antigo, ficha retirada ou endereço mal escrito). */
export function LarNotFound() {
  useDocumentTitle('Instituição não encontrada')
  return (
    <div className="container-page grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="eyebrow">Ficha não encontrada</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          Não encontrámos <em>esta instituição</em>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">
          O link pode estar incompleto, ou a ficha foi retirada pela própria instituição. As vagas mudam todos os dias — no mapa vê as que estão livres
          agora, perto de quem precisa.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink to="/pesquisa" size="lg" icon={<MapIcon aria-hidden className="size-5" />}>
            Ver o mapa de vagas
          </ButtonLink>
          <ButtonLink to="/encontrar" size="lg" variant="secondary" iconRight={<ArrowRight aria-hidden className="size-5" />}>
            Ajuda-me a escolher
          </ButtonLink>
        </div>
      </div>
      <figure className="relative mx-auto w-full max-w-lg">
        <div className="relative -rotate-2 rounded-[1.75rem] border border-line bg-white p-2 shadow-card">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] opacity-60 grayscale">
            <LarCover hue={30} variante={2} />
          </div>
          <AzulejoBand className="absolute inset-x-6 -bottom-3 h-6 rounded-md opacity-40" size={24} />
        </div>
        <figcaption className="mt-6 text-center text-sm text-ink-mute italic">Ficha indisponível</figcaption>
      </figure>
    </div>
  )
}
