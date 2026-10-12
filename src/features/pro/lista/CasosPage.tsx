import { Plus, UserRoundPlus } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useDocumentTitle } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { useCasosComDados, type CasoComDados } from '../shared/data'
import { CasoCard } from './CasoCard'

function Grupo({ id, titulo, itens, className }: { id: string; titulo: string; itens: CasoComDados[]; className?: string }) {
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="text-2xl font-semibold sm:text-3xl">
        {titulo} <span className="font-normal text-ink-mute tabular">{itens.length}</span>
      </h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {itens.map(({ caso, perfil, cands }, i) => (
          <li key={caso.id} className="motion-safe:animate-[fade-up_.6s_cubic-bezier(.16,1,.3,1)_both]" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
            <CasoCard caso={caso} perfil={perfil} cands={cands} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Lista de casos (/casos): abertos primeiro, pela data de alta; depois colocados e fechados. */
export default function CasosPage() {
  useDocumentTitle('Casos')
  const casos = useCasosComDados()
  const abertos = casos.filter((c) => c.caso.estado === 'aberto')
  const outros = casos.filter((c) => c.caso.estado !== 'aberto')

  if (!casos.length) {
    return (
      <EmptyState
        as="h2"
        icon={<UserRoundPlus />}
        title="Ainda não tem casos"
        text="Crie um caso com o perfil de cuidados e a data prevista de alta. Depois, envie-o de uma vez às instituições compatíveis com vaga."
        action={
          <ButtonLink to="/casos/novo" icon={<Plus aria-hidden />}>
            Novo caso
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg text-ink-mute">
          {abertos.length === 0
            ? 'Não tem casos abertos.'
            : abertos.length === 1
              ? 'Um caso aberto, ordenado pela data de alta.'
              : `${abertos.length} casos abertos, ordenados pela data de alta.`}
        </p>
        <ButtonLink to="/casos/novo" icon={<Plus aria-hidden />} className="w-full shrink-0 sm:w-auto">
          Novo caso
        </ButtonLink>
      </div>

      {abertos.length > 0 && <Grupo id="casos-abertos" titulo="Abertos" itens={abertos} className="mt-10" />}
      {outros.length > 0 && <Grupo id="casos-outros" titulo="Colocados e fechados" itens={outros} className={cn(abertos.length ? 'mt-16' : 'mt-10')} />}
    </div>
  )
}
