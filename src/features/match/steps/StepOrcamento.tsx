import { useEffect, useId, useMemo } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ChoiceCard, Switch } from '@/components/ui/Field'
import { useDebounced } from '@/lib/hooks'
import { euro, km } from '@/lib/format'
import { RangeSlider } from '../controls/RangeSlider'
import { contextoPrecos } from '../area'
import { deLocal } from '../language'
import { arredondar, limitar, ORCAMENTO_MAX, ORCAMENTO_MIN, ORCAMENTO_PASSO, type Quarto } from '../model'
import type { StepProps } from './types'

const QUARTOS: { v: Quarto; label: string; desc: string }[] = [
  { v: 'individual', label: 'Individual', desc: 'Mais privacidade.' },
  { v: 'duplo', label: 'Duplo', desc: 'Partilhado, mais económico.' },
  { v: 'casal', label: 'Casal', desc: 'Para continuarem juntos.' },
  { v: 'indiferente', label: 'Indiferente', desc: 'Mostramos todas as opções.' },
]

/** "450–1100 €", sem repetir o símbolo. */
const intervalo = (a: number, b: number) => `${euro(a).replace(/\s?€/, '')}–${euro(b)}`

const passoBtn =
  'flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-ink transition-colors duration-200 hover:bg-sand-deep disabled:opacity-40 disabled:hover:bg-sand'

export function StepOrcamento({ r, patch, lares, p }: StepProps) {
  const id = useId()
  const local = r.local
  const ctx = useMemo(() => (local ? contextoPrecos(lares, local, r.raioKm, r.quarto) : null), [lares, local, r.raioKm, r.quarto])
  const sugerido = limitar(arredondar(ctx?.medianaPrivados ?? 1500, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX)
  const orc = r.orcamentoMax ?? sugerido

  // primeira visita: começa na mediana dos privados da zona
  useEffect(() => {
    if (r.orcamentoMax == null) patch({ orcamentoMax: sugerido })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dentro = ctx ? ctx.pontos.filter((x) => x.preco <= orc).length : 0
  const zona = local ? `${ctx?.alargado ? 'mais próximas' : `a menos de ${r.raioKm}\u00a0km`} ${deLocal(local.label)}` : ''
  const fraseLida = useDebounced(ctx ? `${dentro} de ${ctx.n} instituições ${zona} cabem em ${euro(orc)} por mês.` : '', 500)

  const mudar = (v: number) => patch({ orcamentoMax: limitar(arredondar(v, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX) })

  return (
    <div className="flex flex-col gap-14">
      <section aria-labelledby={`${id}-l`}>
        <label id={`${id}-l`} htmlFor={id} className="sr-only">
          Mensalidade máxima, por pessoa
        </label>
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <button
            type="button"
            onClick={() => mudar(orc - ORCAMENTO_PASSO)}
            disabled={orc <= ORCAMENTO_MIN}
            aria-label={`Menos ${ORCAMENTO_PASSO} euros`}
            className={passoBtn}
          >
            <Minus aria-hidden className="size-5" />
          </button>
          <p
            aria-hidden
            className="min-w-[5.5ch] text-center text-[3.25rem] leading-none font-semibold tracking-tight whitespace-nowrap text-ink tabular sm:text-7xl"
          >
            {euro(orc)}
          </p>
          <button
            type="button"
            onClick={() => mudar(orc + ORCAMENTO_PASSO)}
            disabled={orc >= ORCAMENTO_MAX}
            aria-label={`Mais ${ORCAMENTO_PASSO} euros`}
            className={passoBtn}
          >
            <Plus aria-hidden className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-base text-ink-mute">por mês, por pessoa</p>

        <RangeSlider
          id={id}
          className="mt-8"
          min={ORCAMENTO_MIN}
          max={ORCAMENTO_MAX}
          step={ORCAMENTO_PASSO}
          value={orc}
          onValue={mudar}
          aria-valuetext={`${orc} euros por mês`}
          aria-describedby={ctx ? `${id}-ctx` : undefined}
        />
        <div aria-hidden className="flex justify-between text-sm text-ink-mute tabular">
          <span>{euro(ORCAMENTO_MIN)}</span>
          <span>{euro(ORCAMENTO_MAX)}</span>
        </div>

        {ctx && local && (
          <div id={`${id}-ctx`} className="mt-10">
            <p className="text-center text-lg text-ink-mute">
              <span className="font-semibold text-ink tabular">
                {dentro} de {ctx.n}
              </span>{' '}
              instituições {zona} cabem neste valor.
            </p>
            <dl className="mt-8 grid grid-cols-2 divide-x divide-line text-center">
              <div className="flex flex-col-reverse gap-1 px-2">
                <dt className="text-sm text-ink-mute">Mediana nos privados</dt>
                <dd className="text-xl font-semibold whitespace-nowrap text-ink tabular sm:text-3xl">
                  {ctx.medianaPrivados != null ? euro(ctx.medianaPrivados) : '—'}
                </dd>
              </div>
              <div className="flex flex-col-reverse gap-1 px-2">
                <dt className="text-sm text-ink-mute">IPSS: depende dos rendimentos</dt>
                <dd className="text-xl font-semibold whitespace-nowrap text-ink tabular sm:text-3xl">
                  {ctx.ipss ? intervalo(ctx.ipss.min, ctx.ipss.max) : '—'}
                </dd>
              </div>
            </dl>
            {ctx.alargado && (
              <p className="mt-6 text-center text-sm text-ink-mute">
                Não há instituições a menos de {r.raioKm} km: usamos as {ctx.n} mais próximas (até {km(ctx.ateKm)}) como
                referência.
              </p>
            )}
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {fraseLida}
        </p>
      </section>

      <Switch
        checked={r.precisaAcordoSS}
        onChange={(v) => patch({ precisaAcordoSS: v })}
        label="Preciso de comparticipação da Segurança Social"
        description={
          <>
            Lares com acordo de cooperação: a mensalidade é calculada a partir dos rendimentos{p.proprio ? '' : ` ${p.de}`}.
            {ctx ? ` ${ctx.nAcordoSS === 1 ? 'Há 1 na zona.' : `Há ${ctx.nAcordoSS} na zona.`}` : ''}
          </>
        }
        className="rounded-[1.25rem] bg-sand px-5 py-4"
      />

      <fieldset>
        <legend className="text-base font-medium text-ink">Que tipo de quarto?</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUARTOS.map((q) => (
            <ChoiceCard
              key={q.v}
              name="quarto"
              value={q.v}
              checked={r.quarto === q.v}
              onChange={() => patch({ quarto: q.v })}
              label={q.label}
              description={q.desc}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
