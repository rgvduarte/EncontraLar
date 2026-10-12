import { Reveal } from '@/components/ui/Reveal'

/** Três números grandes, sem caixas: compatíveis, com vaga agora, melhor compatibilidade. */
export function ResultsStats({ n, comVaga, melhor }: { n: number; comVaga: number; melhor: number | null }) {
  const itens = [
    { valor: String(n), label: n === 1 ? 'compatível' : 'compatíveis' },
    { valor: String(comVaga), label: 'com vaga agora', ponto: true },
    { valor: melhor == null ? '—' : `${melhor}%`, label: 'melhor compatibilidade' },
  ]
  return (
    <section aria-label="Resumo das sugestões" className="container-narrow">
      <dl className="grid grid-cols-3 border-y border-line py-10 sm:py-14">
        {itens.map((it, i) => (
          <Reveal key={it.label} delay={i * 90} className={i > 0 ? 'border-l border-line px-2 text-center' : 'px-2 text-center'}>
            <dt className="sr-only">{it.label}</dt>
            <dd className="text-5xl font-semibold tracking-tight text-ink tabular sm:text-6xl lg:text-7xl">{it.valor}</dd>
            <dd aria-hidden className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-mute sm:text-base">
              {it.ponto && <span className="size-2 shrink-0 rounded-full bg-leaf-500" />}
              {it.label}
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  )
}
