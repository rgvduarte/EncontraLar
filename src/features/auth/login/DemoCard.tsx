import type { ReactNode } from 'react'
import { ArrowRight, BedDouble, BellRing, CalendarCheck, ClipboardList, CloudSun, ListOrdered, type LucideIcon } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { InlineSpinner } from '../shared/InlineSpinner'
import { cn } from '@/lib/cn'
import type { PreviewIcon, PreviewRow } from './useDemoPersonas'

const ICON: Record<PreviewIcon, LucideIcon> = {
  lista: ListOrdered,
  visita: CalendarCheck,
  alerta: BellRing,
  vagas: BedDouble,
  pedido: ClipboardList,
  previsao: CloudSun,
}

const ICON_TONE: Record<PreviewIcon, string> = {
  lista: 'bg-dusk-50 text-dusk-700',
  visita: 'bg-pine-50 text-pine-700',
  alerta: 'bg-leaf-50 text-leaf-700',
  vagas: 'bg-leaf-50 text-leaf-700',
  pedido: 'bg-terra-50 text-terra-700',
  previsao: 'bg-sun-50 text-sun-800',
}

export type DemoCardState = 'idle' | 'loading' | 'disabled' | 'current'

/** Cartão de uma conta de demonstração, com pré-visualização do que a pessoa vai encontrar ao entrar. */
export function DemoCard({
  media,
  kicker,
  nome,
  subtitulo,
  historia,
  rows,
  entrarLabel,
  email,
  password,
  state,
  painel,
  onEnter,
}: {
  media: ReactNode
  kicker: ReactNode
  nome: string
  subtitulo?: ReactNode
  historia: string
  rows: PreviewRow[]
  entrarLabel: string
  email: string
  password: string
  state: DemoCardState
  /** caminho do painel quando esta conta já tem a sessão iniciada */
  painel: string
  onEnter: () => void
}) {
  const headingId = `demo-${email.split('@')[0]}`
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col rounded-3xl bg-cream p-4 text-ink shadow-lift ring-1 ring-black/5 sm:rounded-[1.75rem] sm:p-6"
    >
      <header className="flex items-start gap-4">
        {media}
        <div className="min-w-0 pt-0.5">
          <p className="eyebrow">{kicker}</p>
          <h3 id={headingId} className="mt-1 font-display text-2xl leading-tight font-semibold">
            {nome}
          </h3>
          {subtitulo && <div className="mt-1.5">{subtitulo}</div>}
        </div>
      </header>

      <p className="mt-4 text-ink-soft">{historia}</p>

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
          <p className="border-b border-line bg-sand/60 px-4 py-2 text-xs font-bold tracking-[0.1em] text-ink-mute uppercase">
            O que vai encontrar ao entrar
          </p>
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const Icon = ICON[r.icon]
              return (
                <li key={r.icon} className="flex items-start gap-3 px-3.5 py-3 sm:px-4">
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', ICON_TONE[r.icon])}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug font-bold">{r.titulo}</span>
                      <span className="block text-sm leading-snug text-ink-soft">{r.detalhe}</span>
                    </span>
                    {r.valor && (
                      <span className="self-start rounded-xl bg-dusk-50 px-2.5 py-0.5 font-display text-lg font-semibold text-dusk-700 tabular sm:self-center">
                        {r.valor}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {state === 'current' ? (
          <ButtonLink to={painel} variant="primary" iconRight={<ArrowRight aria-hidden className="size-5" />}>
            Sessão iniciada — abrir painel
          </ButtonLink>
        ) : (
          <Button
            onClick={onEnter}
            disabled={state !== 'idle'}
            aria-busy={state === 'loading' || undefined}
            iconRight={state === 'loading' ? <InlineSpinner /> : <ArrowRight aria-hidden className="size-5" />}
          >
            {state === 'loading' ? 'A entrar…' : entrarLabel}
          </Button>
        )}
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-3 text-sm leading-relaxed">
          <dt className="whitespace-nowrap text-ink-mute">Email</dt>
          <dd className="font-mono text-ink">{email}</dd>
          <dt className="whitespace-nowrap text-ink-mute">Palavra-passe</dt>
          <dd className="font-mono text-ink">{password}</dd>
        </dl>
      </div>
    </article>
  )
}
