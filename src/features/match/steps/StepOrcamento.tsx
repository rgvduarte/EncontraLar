import { useEffect, useId, useMemo } from 'react'
import { BedDouble, BedSingle, Info, Landmark, Minus, Plus, Shuffle, Users, type LucideIcon } from 'lucide-react'
import { ChoiceCard, Switch } from '@/components/ui/Field'
import { useDebounced } from '@/lib/hooks'
import { euro, km } from '@/lib/format'
import { cn } from '@/lib/cn'
import { RangeSlider } from '../controls/RangeSlider'
import { contextoPrecos } from '../area'
import { deLocal } from '../language'
import { arredondar, limitar, ORCAMENTO_MAX, ORCAMENTO_MIN, ORCAMENTO_PASSO, type Quarto } from '../model'
import { PriceStrip, PriceStripLegend } from './PriceStrip'
import type { StepProps } from './types'

const QUARTOS: { v: Quarto; label: string; desc: string; Icon: LucideIcon }[] = [
  { v: 'individual', label: 'Individual', desc: 'Mais privacidade; costuma ser a opção mais cara.', Icon: BedSingle },
  { v: 'duplo', label: 'Duplo', desc: 'Partilhado com outra pessoa; mensalidade mais baixa.', Icon: Users },
  { v: 'casal', label: 'Casal', desc: 'Para continuarem juntos, no mesmo quarto.', Icon: BedDouble },
  { v: 'indiferente', label: 'Indiferente', desc: 'Mostramos todas as opções e o preço mais baixo de cada lar.', Icon: Shuffle },
]

const MARCAS = [300, 1000, 2000, 3000, 4000, 5000]

export function StepOrcamento({ r, patch, lares, p }: StepProps) {
  const id = useId()
  const local = r.local
  const ctx = useMemo(
    () => (local ? contextoPrecos(lares, local, r.raioKm, r.quarto) : null),
    [lares, local, r.raioKm, r.quarto],
  )
  const sugerido = limitar(arredondar(ctx?.medianaPrivados ?? 1500, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX)
  const orc = r.orcamentoMax ?? sugerido

  // primeira visita: começa na mediana dos privados da zona
  useEffect(() => {
    if (r.orcamentoMax == null) patch({ orcamentoMax: sugerido })
  }, [])

  const dentro = ctx ? ctx.pontos.filter((x) => x.preco <= orc).length : 0
  const ondeTxt = local ? (ctx?.alargado ? `nas ${ctx.n} mais próximas ${deLocal(local.label)}` : `a menos de ${r.raioKm} km ${deLocal(local.label)}`) : ''
  const frase = ctx ? `${dentro} de ${ctx.n} instituições ${ondeTxt} têm mensalidade de entrada até ${euro(orc)}.` : ''
  const fraseLida = useDebounced(frase, 500)

  const mudar = (v: number) => patch({ orcamentoMax: limitar(arredondar(v, ORCAMENTO_PASSO), ORCAMENTO_MIN, ORCAMENTO_MAX) })

  return (
    <div className="flex flex-col gap-12">
      {/* orçamento */}
      <section aria-labelledby={`${id}-l`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label id={`${id}-l`} htmlFor={id} className="text-lg font-bold text-ink">
              Mensalidade máxima
            </label>
            <p className="text-sm text-ink-soft">Por pessoa, por mês — o valor que a família consegue manter.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => mudar(orc - ORCAMENTO_PASSO)}
              disabled={orc <= ORCAMENTO_MIN}
              aria-label={`Menos ${ORCAMENTO_PASSO} euros`}
              className="flex size-12 items-center justify-center rounded-full border-2 border-line-strong bg-white text-ink hover:border-pine-500 disabled:opacity-40"
            >
              <Minus aria-hidden className="size-5" />
            </button>
            <p aria-hidden className="min-w-44 text-center font-display text-5xl leading-none font-semibold text-pine-800 tabular">
              {euro(orc)}
            </p>
            <button
              type="button"
              onClick={() => mudar(orc + ORCAMENTO_PASSO)}
              disabled={orc >= ORCAMENTO_MAX}
              aria-label={`Mais ${ORCAMENTO_PASSO} euros`}
              className="flex size-12 items-center justify-center rounded-full border-2 border-line-strong bg-white text-ink hover:border-pine-500 disabled:opacity-40"
            >
              <Plus aria-hidden className="size-5" />
            </button>
          </div>
        </div>

        <div className="rounded-4xl border border-line bg-white px-4 pt-5 pb-4 shadow-soft sm:px-6">
          {ctx && ctx.pontos.length > 0 && (
            <PriceStrip pontos={ctx.pontos} min={ORCAMENTO_MIN} max={ORCAMENTO_MAX} orcamento={orc} mediana={ctx.medianaPrivados} />
          )}
          <RangeSlider
            id={id}
            min={ORCAMENTO_MIN}
            max={ORCAMENTO_MAX}
            step={ORCAMENTO_PASSO}
            value={orc}
            onValue={mudar}
            aria-valuetext={`${orc} euros por mês`}
            aria-describedby={`${id}-ctx`}
          />
          <div aria-hidden className="relative h-6 text-sm text-ink-mute tabular">
            {MARCAS.map((m, i) => (
              <span
                key={m}
                className={cn('absolute', i === 0 ? '' : i === MARCAS.length - 1 ? '-translate-x-full' : '-translate-x-1/2')}
                style={{ left: `calc(16px + (100% - 32px) * ${(m - ORCAMENTO_MIN) / (ORCAMENTO_MAX - ORCAMENTO_MIN)})` }}
              >
                {euro(m)}
              </span>
            ))}
          </div>
          <div className="mt-4 border-t border-dashed border-line pt-3">
            <PriceStripLegend />
          </div>
        </div>

        {ctx && (
          <div id={`${id}-ctx`} className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr]">
            <p className="rounded-3xl bg-pine-800 px-5 py-4 text-pine-50">
              <span className="block font-display text-4xl leading-none font-semibold text-white tabular">
                {dentro}
                <span className="text-xl text-pine-200"> de {ctx.n}</span>
              </span>
              <span className="mt-1.5 block text-sm leading-snug">
                instituições {ondeTxt} têm mensalidade de entrada até {euro(orc)}.
              </span>
            </p>
            <p className="rounded-3xl border border-line bg-sand px-5 py-4">
              <span className="block text-sm font-bold text-ink-soft">Mediana nos privados</span>
              <span className="mt-1 block font-display text-3xl leading-none font-semibold text-ink tabular">
                {ctx.medianaPrivados != null ? euro(ctx.medianaPrivados) : '—'}
              </span>
              <span className="mt-1.5 block text-sm text-ink-soft">
                {ctx.nPrivados ? `entre ${ctx.nPrivados} ${ctx.nPrivados === 1 ? 'privado' : 'privados'} da zona` : 'sem privados na zona'}
                {r.quarto !== 'indiferente' ? `, quarto ${r.quarto === 'casal' ? 'de casal' : r.quarto}` : ''}
              </span>
            </p>
            <p className="rounded-3xl border border-line bg-sand px-5 py-4">
              <span className="block text-sm font-bold text-ink-soft">IPSS e Misericórdias</span>
              <span className="mt-1 block font-display text-3xl leading-none font-semibold text-ink tabular">
                {ctx.ipss ? `${euro(ctx.ipss.min)}–${euro(ctx.ipss.max).replace(/\s?€/, '')} €` : '—'}
              </span>
              <span className="mt-1.5 block text-sm text-ink-soft">
                {ctx.ipss ? 'Nas IPSS a mensalidade depende dos rendimentos.' : 'Sem IPSS nem Misericórdias na zona.'}
              </span>
            </p>
          </div>
        )}
        {ctx?.alargado && (
          <p className="flex items-start gap-2 text-sm text-ink-soft">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            Não há instituições a menos de {r.raioKm} km; usamos as {ctx.n} mais próximas (até {km(ctx.ateKm)}) como referência.
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {fraseLida}
        </p>
      </section>

      {/* comparticipação */}
      <section className="rounded-4xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-4">
          <span aria-hidden className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-pine-50 text-pine-700 sm:flex">
            <Landmark className="size-6" />
          </span>
          <Switch
            className="flex-1"
            checked={r.precisaAcordoSS}
            onChange={(v) => patch({ precisaAcordoSS: v })}
            label="Preciso de comparticipação da Segurança Social"
            description={
              <>
                Mostramos primeiro lares com vagas em acordo de cooperação — sobretudo IPSS e Misericórdias — onde a mensalidade é
                calculada a partir dos rendimentos{p.proprio ? '' : ` ${p.de}`}.
                {ctx ? ` ${ctx.nAcordoSS} ${ctx.nAcordoSS === 1 ? 'instituição' : 'instituições'} da zona ${ctx.nAcordoSS === 1 ? 'tem' : 'têm'} acordo.` : ''}
              </>
            }
          />
        </div>
      </section>

      {/* quarto */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-4 text-lg font-bold text-ink">Que tipo de quarto?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUARTOS.map((q) => (
            <ChoiceCard
              key={q.v}
              name="quarto"
              value={q.v}
              checked={r.quarto === q.v}
              onChange={() => patch({ quarto: q.v })}
              icon={<q.Icon aria-hidden />}
              label={q.label}
              description={q.desc}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
