import { ButtonLink } from '@/components/ui/Button'
import { useDocumentTitle } from '@/lib/hooks'
import { useAcesso } from '@/lib/store'

/** A instituição pedida não existe (link antigo, ficha retirada ou endereço mal escrito). */
export function LarNotFound() {
  useDocumentTitle('Instituição não encontrada')
  // na versão grátis o mapa não diz quais têm vaga: não o prometemos
  const { completo } = useAcesso()
  return (
    <div className="container-narrow flex flex-col items-center py-24 text-center sm:py-32 lg:py-40">
      <p className="eyebrow">Ficha não encontrada</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Não encontrámos esta instituição</h1>
      <p className="mt-5 max-w-xl text-xl text-ink-mute">
        {completo
          ? 'O link pode estar incompleto ou a ficha foi retirada. No mapa vê as vagas livres hoje.'
          : 'O link pode estar incompleto ou a ficha foi retirada. No mapa encontra as instituições de cada zona.'}
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/pesquisa" size="lg">
          Ver o mapa de vagas
        </ButtonLink>
        <ButtonLink to="/encontrar" size="lg" variant="subtle">
          Ajuda-me a escolher
        </ButtonLink>
      </div>
    </div>
  )
}
