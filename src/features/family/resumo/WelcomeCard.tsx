import { X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'

/** Boas-vindas curtas (?bemvindo=1): uma frase e o primeiro passo certo. */
export function WelcomeCard({
  nome,
  temPerfil,
  pesquisa,
  onClose,
}: {
  nome: string
  temPerfil: boolean
  pesquisa: string
  onClose: () => void
}) {
  return (
    <section aria-labelledby="bemvindo" className="tile relative animate-fade-up">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar boas-vindas"
        className="absolute top-4 right-4 flex size-12 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand-deep hover:text-ink"
      >
        <X aria-hidden className="size-5" />
      </button>
      <h2 id="bemvindo" className="pr-12 text-3xl font-semibold sm:text-4xl">
        Olá, {nome}. A conta está pronta.
      </h2>
      <p className="mt-3 max-w-xl text-lg text-ink-mute">
        {temPerfil
          ? 'O perfil já está guardado. Agora é guardar instituições e pedir vaga — acompanha tudo aqui.'
          : 'Comece por descrever a pessoa de quem cuida. As sugestões e os avisos de vaga passam a ser à medida.'}
      </p>
      <ButtonLink to={temPerfil ? pesquisa : '/familia/perfil'} className="mt-7">
        {temPerfil ? 'Abrir o mapa de vagas' : 'Criar perfil de cuidados'}
      </ButtonLink>
    </section>
  )
}
