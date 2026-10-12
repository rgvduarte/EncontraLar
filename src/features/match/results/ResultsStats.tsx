import { CountUp, Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'

/**
 * Três números grandes, sem caixas: compatíveis, com vaga agora, melhor compatibilidade.
 * Entram em cascata e contam até ao valor (o valor final é lido de imediato pelos leitores de ecrã).
 */
export function ResultsStats({ n, comVaga, melhor }: { n: number; comVaga: number; melhor: number | null }) {
  // `curto`: rótulo visível abaixo de 640px — cada coluna tem ~100px a 360px e "compatibilidade" não parte
  const itens: { valor: number | null; label: string; curto?: string; ponto?: boolean; pct?: boolean }[] = [
    { valor: n, label: n === 1 ? 'compatível' : 'compatíveis' },
    { valor: comVaga, label: 'com vaga agora', ponto: true },
    { valor: melhor, label: 'melhor compatibilidade', curto: 'mais compatível', pct: true },
  ]
  return (
    <section aria-label="Resumo das sugestões" className="container-narrow">
      <dl className="grid grid-cols-3 border-y border-line py-9 sm:py-14">
        {itens.map((it, i) => {
          const texto = it.valor == null ? '—' : `${it.valor}${it.pct ? '%' : ''}`
          return (
            <Reveal
              key={it.label}
              variant="up"
              delay={i * 100}
              className={i > 0 ? 'min-w-0 border-l border-line px-1.5 text-center sm:px-2' : 'min-w-0 px-1.5 text-center sm:px-2'}
            >
              <dt className="sr-only">{it.label}</dt>
              <dd className="text-[2.625rem] leading-none font-semibold tracking-tight text-ink tabular sm:text-6xl lg:text-7xl">
                {it.valor == null ? (
                  '—'
                ) : (
                  <>
                    <span aria-hidden>
                      <CountUp
                        value={it.valor}
                        duration={1100 + i * 150}
                        format={(v) => `${Math.round(v)}${it.pct ? '%' : ''}`}
                      />
                    </span>
                    <span className="sr-only">{texto}</span>
                  </>
                )}
              </dd>
              <dd aria-hidden className="mt-3 inline-flex items-center gap-1.5 text-sm leading-snug text-ink-mute sm:text-base">
                {it.ponto && <span className={cn('size-2 shrink-0 rounded-full', it.valor ? 'bg-leaf-500' : 'bg-dusk-500')} />}
                {it.curto ? (
                  <>
                    <span className="sm:hidden">{it.curto}</span>
                    <span className="max-sm:hidden">{it.label}</span>
                  </>
                ) : (
                  it.label
                )}
              </dd>
            </Reveal>
          )
        })}
      </dl>
    </section>
  )
}
