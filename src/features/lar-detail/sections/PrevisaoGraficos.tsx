import { MESES_CURTOS, MESES_LONGOS, num, plural } from '@/lib/format'
import { cn } from '@/lib/cn'

/** Mini-barras das saídas registadas nos últimos 12 meses (o último valor é o mês corrente). */
export function SaidasBarras({ historico }: { historico: number[] }) {
  if (!historico.length) {
    return (
      <div>
        <p className="font-bold text-ink">Saídas registadas</p>
        <p className="mt-1 text-sm text-ink-soft">A instituição ainda não tem histórico de saídas no EncontraLar; a previsão usa valores típicos.</p>
      </div>
    )
  }
  const agora = new Date()
  const n = historico.length
  const meses = historico.map((v, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (n - 1 - i), 1)
    return { v, mes: d.getMonth(), ano: d.getFullYear() }
  })
  const max = Math.max(1, ...historico)
  const total = historico.reduce((a, b) => a + b, 0)
  const media = total / n

  return (
    <figure>
      <figcaption>
        <span className="font-bold text-ink">Saídas registadas</span>
        <span className="block text-sm text-ink-soft">
          {plural(total, 'saída', 'saídas')} nos últimos {n} meses · média de {media.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} por mês
        </span>
      </figcaption>
      <div className="mt-4 flex h-28 items-end gap-1.5" aria-hidden>
        {meses.map((m, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold text-ink-soft tabular">{m.v || ''}</span>
            <span
              className={cn('w-full max-w-7 rounded-t-md', i === n - 1 ? 'bg-terra-500' : 'bg-pine-400')}
              style={{ height: m.v ? `${(m.v / max) * 70}%` : '2px' }}
            />
            <span className={cn('text-xs', i === n - 1 ? 'font-bold text-ink' : 'text-ink-mute')}>{MESES_CURTOS[m.mes]![0]!.toUpperCase()}</span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {meses.map((m, i) => (
          <li key={i}>
            {MESES_LONGOS[m.mes]} de {m.ano}: {plural(m.v, 'saída', 'saídas')}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Lista de espera inscrita vs. lista efetiva (pessoas que ainda aceitam quando contactadas). */
export function ListaEsperaVisual({ inscritos, efetiva }: { inscritos: number; efetiva: number }) {
  if (inscritos <= 0) {
    return (
      <div>
        <p className="font-bold text-ink">Lista de espera</p>
        <p className="mt-1 text-sm text-ink-soft">Não há ninguém inscrito neste momento.</p>
      </div>
    )
  }
  const pontos = inscritos <= 60
  return (
    <figure>
      <figcaption>
        <span className="font-bold text-ink">Lista de espera</span>
        <span className="block text-sm text-ink-soft">
          {plural(inscritos, 'pessoa inscrita', 'pessoas inscritas')} · cerca de <strong className="text-ink">{num(efetiva)}</strong> à sua frente na
          prática
        </span>
      </figcaption>
      {pontos ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: inscritos }, (_, i) => (
            <span key={i} className={cn('size-3.5 rounded-full', i < efetiva ? 'bg-dusk-600' : 'border-2 border-dusk-200')} />
          ))}
        </div>
      ) : (
        <div className="mt-4 h-4 overflow-hidden rounded-full border-2 border-dusk-200" aria-hidden>
          <div className="h-full rounded-full bg-dusk-600" style={{ width: `${(efetiva / inscritos) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-dusk-600" /> Ainda aceitam a vaga
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full border-2 border-dusk-200" /> Já resolveram ou estão inscritas noutros lares
        </span>
      </div>
    </figure>
  )
}
