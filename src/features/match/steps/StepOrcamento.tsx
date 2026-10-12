import { useId, useMemo } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Switch } from '@/components/ui/Field'
import { useDebounced } from '@/lib/hooks'
import { euro, km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { RangeSlider } from '../controls/RangeSlider'
import { contextoPrecos } from '../area'
import { AnimatedNumber } from '../motion'
import { deLocal } from '../language'
import { arredondar, limitar, ORCAMENTO_MAX, ORCAMENTO_MIN, ORCAMENTO_PASSO, semLimiteOrcamento, type Quarto } from '../model'
import type { StepProps } from './types'
import { ChoiceTile } from '../controls/ChoiceTile'
import { ToggleChip } from '../controls/Chips'

const QUARTOS: { v: Quarto; label: string; desc: string }[] = [
  { v: 'individual', label: 'Individual', desc: 'Mais privacidade.' },
  { v: 'duplo', label: 'Duplo', desc: 'Partilhado, mais económico.' },
  { v: 'casal', label: 'Casal', desc: 'Para continuarem juntos.' },
  { v: 'indiferente', label: 'Indiferente', desc: 'Mostramos todas as opções.' },
]

/** "450–1100 €", sem repetir o símbolo. */
const intervalo = (a: number, b: number) => `${euro(a).replace(/\s?€/, '')}–${euro(b)}`

const passoBtn =
  'flex size-12 shrink-0 items-center justify-center rounded-full bg-sand text-ink select-none transition-[background-color,scale,opacity] duration-200 hover:bg-sand-deep active:scale-90 disabled:opacity-40 disabled:hover:bg-sand disabled:active:scale-100 motion-reduce:active:scale-100 pointer-coarse:size-14'

export function StepOrcamento({ r, patch, erros, lares, p }: StepProps) {
  const id = useId()
  const local = r.local
  const ctx = useMemo(() => (local ? contextoPrecos(lares, local, r.raioKm, r.quarto) : null), [lares, local, r.raioKm, r.quarto])
  // referência (mediana dos privados da zona): marca o ponto de partida da régua, mas nunca responde pela pessoa
  const sugerido = limitar(arredondar(ctx?.medianaPrivados ?? 1500, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX)
  const vazio = r.orcamentoMax == null
  const semLimite = semLimiteOrcamento(r.orcamentoMax)
  const orc = r.orcamentoMax ?? sugerido

  const dentro = ctx ? ctx.pontos.filter((x) => x.preco <= orc).length : 0
  const zona = local ? `${ctx?.alargado ? 'mais próximas' : `a menos de ${r.raioKm}\u00a0km`} ${deLocal(local.label)}` : ''
  const fraseLida = useDebounced(
    ctx && !vazio
      ? semLimite
        ? `Sem limite: mostramos as ${ctx.n} instituições ${zona}.`
        : `${dentro} de ${ctx.n} instituições ${zona} cabem em ${euro(orc)} por mês.`
      : '',
    500,
  )

  const mudar = (v: number) => patch({ orcamentoMax: limitar(arredondar(v, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX) })
  const errId = `${id}-err`

  return (
    <div className="flex flex-col gap-14">
      <section data-campo aria-labelledby={`${id}-l`}>
        <label id={`${id}-l`} htmlFor={id} className="sr-only">
          Mensalidade máxima, por pessoa
        </label>
        <div className="flex items-center justify-center gap-3 sm:gap-8">
          <button
            type="button"
            onClick={() => mudar(orc - ORCAMENTO_PASSO)}
            disabled={!vazio && orc <= ORCAMENTO_MIN}
            aria-label={`Menos ${ORCAMENTO_PASSO} euros`}
            className={passoBtn}
          >
            <Minus aria-hidden className="size-5" />
          </button>
          <p
            aria-hidden
            className={cn(
              'min-w-[5.5ch] text-center text-[3.25rem] leading-none font-semibold tracking-tight whitespace-nowrap tabular transition-colors duration-300 sm:text-7xl',
              vazio ? 'text-line-strong' : 'text-ink',
            )}
          >
            {vazio ? '— €' : euro(orc)}
          </p>
          <button
            type="button"
            onClick={() => mudar(orc + ORCAMENTO_PASSO)}
            disabled={!vazio && orc >= ORCAMENTO_MAX}
            aria-label={`Mais ${ORCAMENTO_PASSO} euros`}
            className={passoBtn}
          >
            <Plus aria-hidden className="size-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-base text-ink-mute">
          {vazio
            ? 'Escolha um valor por mês, por pessoa'
            : semLimite
              ? 'ou mais — sem limite, mostramos todos os preços'
              : 'por mês, por pessoa'}
        </p>

        <RangeSlider
          id={id}
          className="mt-8"
          min={ORCAMENTO_MIN}
          max={ORCAMENTO_MAX}
          step={ORCAMENTO_PASSO}
          value={orc}
          vazio={vazio}
          onValue={mudar}
          aria-valuetext={
            vazio
              ? `Por escolher. Referência: ${sugerido} euros, a mediana nos privados da zona`
              : semLimite
                ? 'Sem limite'
                : `${orc} euros por mês`
          }
          aria-invalid={erros.orcamento ? true : undefined}
          aria-describedby={[erros.orcamento ? errId : '', ctx ? `${id}-ctx` : ''].filter(Boolean).join(' ') || undefined}
        />
        <div aria-hidden className="flex justify-between text-sm text-ink-mute tabular">
          <span>{euro(ORCAMENTO_MIN)}</span>
          <span>{euro(ORCAMENTO_MAX)}</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
          <ToggleChip pressed={semLimite} onToggle={() => patch({ orcamentoMax: semLimite ? null : ORCAMENTO_MAX })}>
            Ainda não sei
          </ToggleChip>
          <span className="text-sm text-ink-mute">Depende dos rendimentos? Mostramos todos os preços.</span>
        </div>
        {erros.orcamento && (
          <p id={errId} role="alert" className="mt-4 text-center text-sm font-medium text-alert-700">
            {erros.orcamento}
          </p>
        )}

        {ctx && local && (
          <div id={`${id}-ctx`} className="mt-10">
            <p className="text-center text-lg text-ink-mute">
              {vazio || semLimite ? (
                <>
                  Preços de referência das{' '}
                  <span className="font-semibold text-ink tabular">
                    <AnimatedNumber value={ctx.n} />
                  </span>{' '}
                  instituições {zona}.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink tabular">
                    <AnimatedNumber value={dentro} /> de <AnimatedNumber value={ctx.n} />
                  </span>{' '}
                  instituições {zona} cabem neste valor.
                </>
              )}
            </p>
            <dl className="mt-8 grid grid-cols-2 divide-x divide-line text-center">
              <div className="flex flex-col-reverse gap-1 px-2">
                <dt className="text-sm text-ink-mute">Mediana nos privados</dt>
                <dd className="text-xl font-semibold whitespace-nowrap text-ink tabular sm:text-3xl">
                  {ctx.medianaPrivados != null ? <AnimatedNumber value={ctx.medianaPrivados} format={euro} /> : '—'}
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
            <ChoiceTile
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
