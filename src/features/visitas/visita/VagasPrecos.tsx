import { Info } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { FieldShell } from '@/components/ui/Field'
import { QUARTO_LABEL } from '@/lib/labels'
import { euro, num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Stepper } from '@/features/lar-dashboard/shared/Stepper'
import { soAlgarismos, type ErrosVisita, type QuartoForm } from '../formulario'
import { Secao } from '../ui'

// os contornos dos campos do kit (Field): pine-400 chega a 3:1 sobre branco
const CAMPO =
  'min-h-13 w-full rounded-2xl border border-pine-400 bg-white py-3 pr-11 pl-4 text-base text-ink tabular placeholder:text-ink-mute ' +
  'transition-[border-color,box-shadow] hover:border-pine-500 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sand aria-[invalid=true]:border-alert-600 aria-[invalid=true]:ring-alert-50'

/** Mensalidade em euros inteiros, com "€" depois do número. */
function PrecoField({
  campo,
  label,
  sr,
  value,
  onChange,
  error,
}: {
  campo: string
  label: string
  /** o resto do nome para o leitor de ecrã ("Quarto individual: mensalidade desde, em euros") */
  sr: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div data-campo={campo}>
      <FieldShell
        label={
          <>
            <span className="sr-only">{sr} </span>
            {label}
          </>
        }
        error={error}
      >
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <input
              id={id}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="next"
              value={value}
              onChange={(e) => onChange(soAlgarismos(e.target.value))}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className={CAMPO}
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-mute">
              €
            </span>
          </div>
        )}
      </FieldShell>
    </div>
  )
}

/**
 * (c) Vagas e preços por tipo de quarto: contador de lugares livres (0 a total) e mensalidade mínima e máxima,
 * começando com o que a ficha diz. Cada parte só se muda com o interruptor respetivo ligado (Verificação).
 */
export function VagasPrecos({
  lar,
  quartos,
  vagas,
  precos,
  erros,
  onQuarto,
}: {
  lar: Lar
  quartos: QuartoForm[]
  vagas: boolean
  precos: boolean
  erros: ErrosVisita
  onQuarto: (tipo: TipoQuarto, patch: Partial<QuartoForm>) => void
}) {
  const comFicha = quartos.flatMap((q) => {
    const atual = lar.quartos.find((x) => x.tipo === q.tipo)
    return atual ? [{ q, atual }] : []
  })
  return (
    <Secao id="vagas" titulo="Vagas e preços" texto="Por tipo de quarto, como estão hoje. Mensalidade por pessoa.">
      {!vagas && !precos && (
        <p className="mb-5 flex items-start gap-2.5 rounded-2xl bg-sand px-4 py-3 text-ink-soft">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-mute" />
          Ligue «Vagas confirmadas» ou «Preços confirmados» em Verificação para atualizar a ficha.
        </p>
      )}
      {comFicha.length === 0 ? (
        <p className="text-ink-mute">A ficha ainda não tem tipos de quarto.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comFicha.map(({ q, atual }) => {
            const nome = QUARTO_LABEL[q.tipo]
            const nomeMin = nome.charAt(0).toLowerCase() + nome.slice(1)
            return (
              <li key={q.tipo} className="rounded-[1.5rem] p-5 ring-1 ring-line sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-xl font-semibold">{nome}</h3>
                  <p className="text-sm text-ink-mute tabular">
                    {atual.total} {atual.total === 1 ? 'lugar' : 'lugares'} · na ficha: {atual.livres} {atual.livres === 1 ? 'livre' : 'livres'},{' '}
                    {atual.precoMin === atual.precoMax ? euro(atual.precoMin) : `${num(atual.precoMin)}–${euro(atual.precoMax)}`}
                  </p>
                </div>

                <fieldset disabled={!vagas} className={cn('mt-5 transition-opacity duration-200', !vagas && 'opacity-45')}>
                  <legend className="sr-only">Lugares livres em {nomeMin}</legend>
                  <Stepper
                    value={Math.min(q.livres, atual.total)}
                    max={atual.total}
                    onChange={(v) => onQuarto(q.tipo, { livres: v })}
                    label={`Lugares livres em ${nomeMin}`}
                    unidade={`lugar livre em ${nomeMin}`}
                    sufixo={`livres de ${atual.total}`}
                    className="max-md:w-full max-md:justify-between"
                  />
                </fieldset>

                <fieldset disabled={!precos} className={cn('mt-6 transition-opacity duration-200', !precos && 'opacity-45')}>
                  <legend className="text-sm text-ink-mute">Mensalidade por pessoa</legend>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <PrecoField
                      campo={`precoMin:${q.tipo}`}
                      label="Desde"
                      sr={`${nome}: mensalidade em euros,`}
                      value={q.precoMin}
                      onChange={(v) => onQuarto(q.tipo, { precoMin: v })}
                      error={precos ? erros[`precoMin:${q.tipo}`] : undefined}
                    />
                    <PrecoField
                      campo={`precoMax:${q.tipo}`}
                      label="Até"
                      sr={`${nome}: mensalidade em euros,`}
                      value={q.precoMax}
                      onChange={(v) => onQuarto(q.tipo, { precoMax: v })}
                      error={precos ? erros[`precoMax:${q.tipo}`] : undefined}
                    />
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}
