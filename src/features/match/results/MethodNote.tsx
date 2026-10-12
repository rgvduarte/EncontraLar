import { PESOS } from '@/lib/matching'
import { cn } from '@/lib/cn'
import { PARCELA_LABEL } from './WhyPanel'

const TONS = ['bg-pine-700', 'bg-pine-500', 'bg-terra-500', 'bg-sun-400', 'bg-dusk-500']

/** "Como ordenamos": os pesos reais do motor de compatibilidade, numa barra só. */
export function MethodNote({ className }: { className?: string }) {
  const chaves = Object.keys(PESOS) as (keyof typeof PESOS)[]
  const total = chaves.reduce((s, k) => s + PESOS[k], 0)
  return (
    <section aria-labelledby="metodo-t" className={cn('rounded-4xl border border-line bg-sand p-6 sm:p-8', className)}>
      <p className="eyebrow">Transparência</p>
      <h2 id="metodo-t" className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
        Como <em>ordenamos</em> as sugestões
      </h2>
      <p className="mt-3 max-w-2xl text-base text-ink-soft">
        Primeiro, eliminamos o que não serve: lares que não admitem o grau de dependência ou que não asseguram um cuidado
        permanente (enfermagem 24 horas, demência, acamados, paliativos, oxigénio). Depois, cada lar soma pontos:
      </p>
      <div aria-hidden className="mt-5 flex h-4 overflow-hidden rounded-full">
        {chaves.map((k, i) => (
          <span key={k} className={cn('h-full', TONS[i])} style={{ width: `${(PESOS[k] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {chaves.map((k, i) => (
          <li key={k} className="flex items-center gap-2.5 text-sm text-ink">
            <span aria-hidden className={cn('size-3 shrink-0 rounded-full', TONS[i])} />
            <span className="flex-1">{PARCELA_LABEL[k]}</span>
            <span className="font-bold tabular">{PESOS[k]} pontos</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-sm text-ink-mute">
        A previsão de vagas é uma estimativa estatística feita a partir do histórico de saídas de cada instituição — não é uma
        garantia. Confirme sempre com a instituição.
      </p>
    </section>
  )
}
