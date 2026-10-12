import { CountUp } from '@/components/motion'

/** Três números grandes, sem caixas: compatíveis, com vaga agora, melhor compatibilidade. */
export function ResultsStats({ n, comVaga, melhor }: { n: number; comVaga: number; melhor: number | null }) {
  const itens = [
    { v: n, label: n === 1 ? 'compatível' : 'compatíveis', fmt: (x: number) => String(Math.round(x)) },
    { v: comVaga, label: 'com vaga agora', fmt: (x: number) => String(Math.round(x)), ponto: true },
    { v: melhor, label: 'melhor compatibilidade', fmt: (x: number) => `${Math.round(x)}%` },
  ]
  return (
    <section aria-label="Resumo das sugestões" className="container-narrow">
      <dl className="grid animate-fade-up grid-cols-3 border-y border-line py-10 [animation-delay:160ms] sm:py-14">
        {itens.map((it, i) => (
          <div key={it.label} className={i > 0 ? 'border-l border-line px-2 text-center' : 'px-2 text-center'}>
            <dt className="sr-only">{it.label}</dt>
            <dd className="text-5xl font-semibold tracking-tight text-ink tabular sm:text-6xl lg:text-7xl">
              {it.v == null ? (
                '—'
              ) : (
                <>
                  <span className="sr-only">{it.fmt(it.v)}</span>
                  <span aria-hidden>
                    <CountUp value={it.v} duration={900} format={it.fmt} />
                  </span>
                </>
              )}
            </dd>
            <dd aria-hidden className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-mute sm:text-base">
              {it.ponto && <span className="size-2 shrink-0 rounded-full bg-leaf-500" />}
              {it.label}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
