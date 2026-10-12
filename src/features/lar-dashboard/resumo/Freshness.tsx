import { useEffect, useState } from 'react'
import { Check, CircleCheck, TriangleAlert } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { confirmarVagasAtualizadas } from '@/lib/store'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { diasDesde, frescura } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { MoreLink } from '../shared/ui'

/** "Vagas atualizadas há X" + um toque para confirmar que nada mudou. */
export function Freshness({ lar }: { lar: Lar }) {
  const agora = useAgora(30_000)
  const [confirmado, setConfirmado] = useState(false)
  const velha = frescura(lar.atualizadoEm, agora) === 'desatualizada'
  const dias = Math.floor(diasDesde(lar.atualizadoEm, agora))

  useEffect(() => {
    if (!confirmado) return
    const t = setTimeout(() => setConfirmado(false), 6000)
    return () => clearTimeout(t)
  }, [confirmado])

  const confirmar = () => {
    confirmarVagasAtualizadas(lar.id)
    setConfirmado(true)
    toast.success('Vagas confirmadas', 'A ficha mostra agora que a informação é de hoje.')
  }

  return (
    <section
      aria-labelledby="frescura-titulo"
      className={cn(
        'flex flex-col gap-6 rounded-[1.75rem] p-7 transition-colors duration-300 sm:p-9 md:flex-row md:items-center md:justify-between',
        velha && !confirmado ? 'bg-sun-50' : 'bg-sand',
      )}
    >
      <div className="min-w-0">
        <h2 id="frescura-titulo" className={cn('flex items-start gap-2.5 text-2xl font-semibold sm:text-3xl', velha && !confirmado && 'text-sun-800')}>
          {velha && !confirmado && <TriangleAlert aria-hidden className="mt-1 size-7 shrink-0" strokeWidth={1.75} />}
          Vagas atualizadas {tempoRelativo(lar.atualizadoEm, new Date(agora))}.
        </h2>
        <p className="mt-1.5 max-w-xl text-ink-mute">
          {velha && !confirmado
            ? `Há ${dias} dias sem confirmar. Fichas antigas descem nos resultados — e as famílias voltam a telefonar.`
            : 'Se nada mudou, confirme. As famílias confiam mais em informação recente.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2">
        {confirmado ? (
          <p role="status" className="inline-flex min-h-14 animate-fade-in items-center gap-2 text-lg font-medium text-leaf-700">
            <CircleCheck aria-hidden className="size-6" strokeWidth={1.75} /> Confirmado
          </p>
        ) : (
          <Button size="lg" icon={<Check aria-hidden strokeWidth={2.5} />} onClick={confirmar} className="max-sm:w-full">
            Está tudo certo
          </Button>
        )}
        <MoreLink to="/gestao/vagas">Alterar vagas</MoreLink>
      </div>
    </section>
  )
}
