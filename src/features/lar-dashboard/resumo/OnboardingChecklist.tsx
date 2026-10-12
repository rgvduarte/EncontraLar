import { useSearchParams } from 'react-router'
import { Check, X } from 'lucide-react'
import type { Lar, User } from '@/types'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { extenso, passosArranque } from '../lib/derive'
import { useLocalFlag } from '../lib/hooks'
import { MoreLink, capitalizar } from '../shared/ui'

/** Primeiros passos para instituições acabadas de registar (?bemvindo=1) ou com a ficha por completar. */
export function OnboardingChecklist({ lar, user }: { lar: Lar; user: User | null }) {
  const [params, setParams] = useSearchParams()
  const [dispensado, setDispensado] = useLocalFlag(`arranque-dispensado:${lar.id}`)
  const passos = passosArranque(lar, user)
  const feitos = passos.filter((p) => p.feito).length
  const bemvindo = params.get('bemvindo') === '1'
  if (!bemvindo && (dispensado || feitos === passos.length)) return null

  const fechar = () => {
    setDispensado(true)
    if (bemvindo) {
      const next = new URLSearchParams(params)
      next.delete('bemvindo')
      setParams(next, { replace: true })
    }
  }

  return (
    <Reveal variant="scale" duration={900}>
    <section aria-labelledby="arranque-titulo" className="tile relative max-sm:p-6">
      <button
        type="button"
        onClick={fechar}
        className="absolute top-4 right-4 flex size-12 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand-deep hover:text-ink"
        aria-label="Dispensar os primeiros passos"
      >
        <X aria-hidden className="size-5" />
      </button>
      <p className="text-sm text-ink-mute">
        Primeiros passos · {feitos} de {passos.length}
      </p>
      <h2 id="arranque-titulo" className="mt-1.5 max-w-xl pr-10 text-2xl font-semibold sm:text-3xl">
        {feitos === passos.length ? 'A ficha está pronta.' : `${capitalizar(extenso(passos.length))} passos para as famílias o encontrarem.`}
      </h2>
      <ol className="mt-6 divide-y divide-line-strong/50">
        {passos.map((p, i) => (
          <li key={p.id} className="flex items-center gap-4 py-4">
            <span
              aria-hidden
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                p.feito ? 'bg-leaf-500 text-white' : 'bg-white text-ink',
              )}
            >
              {p.feito ? <Check className="size-4.5" strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={cn('font-semibold', p.feito && 'text-ink-mute line-through decoration-1')}>
                <span className="sr-only">Passo {i + 1}: </span>
                {p.titulo}
                {p.feito && <span className="sr-only"> (feito)</span>}
              </h3>
              {!p.feito && <p className="text-sm text-ink-mute">{p.texto}</p>}
            </div>
            {p.feito ? (
              <span className="text-sm text-leaf-700">Feito</span>
            ) : (
              <MoreLink to={p.to} aria-label={`${p.cta}: ${p.titulo}`}>
                {p.cta}
              </MoreLink>
            )}
          </li>
        ))}
      </ol>
      {lar.verificacao.estado !== 'verificado' && (
        <p className="mt-4 text-sm text-ink-mute">
          Entretanto, verificamos a licença de funcionamento{lar.verificacao.licenca ? ` n.º ${lar.verificacao.licenca}` : ''}.{' '}
          <MoreLink to="/gestao/ficha#verificacao" className="text-sm">
            Ver estado
          </MoreLink>
        </p>
      )}
    </section>
    </Reveal>
  )
}
