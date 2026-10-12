import type { ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'
import type { Lar } from '@/types'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { AzulejoBand, azulejoBg } from '@/components/brand/patterns'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { euro, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { eProprio, idadeNum, PASSOS, passoValido, type Rascunho } from '../model'
import { pessoa, URGENCIA_CURTA } from '../language'
import { funil } from '../area'

/** Resumo curto da resposta de cada passo (ou null se ainda não respondido). */
export function resumoPasso(i: number, r: Rascunho): ReactNode | null {
  switch (i) {
    case 0: {
      if (!r.relacao) return null
      const idade = idadeNum(r)
      const nome = r.nome.trim().split(/\s+/)[0]
      return [r.relacao, nome, idade != null ? `${idade} anos` : null].filter(Boolean).join(' · ')
    }
    case 1:
      return r.grau ? GRAU_LABEL[r.grau] : null
    case 2:
      if (r.semNecessidades) return 'Sem necessidades especiais'
      if (!r.necessidades.length) return null
      return (
        <span className="flex flex-wrap gap-x-2.5 gap-y-1">
          {r.necessidades.slice(0, 3).map((n) => {
            const Icon = CUIDADO_ICON[n]
            return (
              <span key={n} className="inline-flex items-center gap-1">
                <Icon aria-hidden className="size-4 text-pine-700" />
                {CUIDADO_LABEL[n].replace(' e Alzheimer', '')}
              </span>
            )
          })}
          {r.necessidades.length > 3 && <span className="text-ink-mute">+{r.necessidades.length - 3}</span>}
        </span>
      )
    case 3:
      return r.local ? `${r.local.label} · até ${r.raioKm} km` : null
    case 4:
      if (r.orcamentoMax == null) return null
      return [
        `Até ${euro(r.orcamentoMax)}/mês`,
        r.quarto === 'indiferente' ? null : `Quarto ${QUARTO_CURTO[r.quarto].toLowerCase()}`,
        r.precisaAcordoSS ? 'Seg. Social' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    default:
      if (!r.urgencia) return null
      return r.preferencias.length
        ? `${URGENCIA_CURTA[r.urgencia]} · ${plural(r.preferencias.length, 'prioridade', 'prioridades')}`
        : URGENCIA_CURTA[r.urgencia]
  }
}

/** Medalhão com a inicial, em moldura de azulejo — o "retrato" da pessoa. */
function Medalhao({ r, className }: { r: Rascunho; className?: string }) {
  const inicial = (r.nome.trim() || (eProprio(r) ? '' : r.relacao)).charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className={cn('relative flex size-20 shrink-0 items-center justify-center rounded-full bg-white p-1.5 shadow-card', className)}
    >
      <span className="absolute inset-1.5 rounded-full opacity-25" style={azulejoBg('#1d564e', 1, 30)} />
      <span className="relative flex size-full items-center justify-center rounded-full border-2 border-pine-700/70 bg-cream/80">
        {inicial ? (
          <span className="font-display text-4xl leading-none font-medium text-terra-600 italic">{inicial}</span>
        ) : (
          <span className="font-display text-xl leading-none text-pine-700/70 italic">?</span>
        )}
      </span>
    </span>
  )
}

/** Índice dos 6 passos, que é também o retrato: cada linha mostra a resposta já dada. */
export function IndicePassos({
  r,
  passo,
  alcancado,
  onIrPara,
  className,
}: {
  r: Rascunho
  passo: number
  alcancado: number
  onIrPara: (i: number) => void
  className?: string
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {PASSOS.map((s, i) => {
        const atual = i === passo
        const resumo = resumoPasso(i, r)
        const feito = !atual && passoValido(i, r) && resumo != null
        const alcancavel = i <= alcancado
        const numero = String(i + 1).padStart(2, '0')
        const conteudo = (
          <>
            <span
              aria-hidden
              className={cn(
                'w-9 shrink-0 pt-0.5 font-display text-xl leading-none font-semibold tabular',
                atual ? 'text-terra-600' : feito ? 'text-pine-700' : 'text-ink-mute/70',
              )}
            >
              {numero}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn('flex items-center gap-2 text-base leading-tight font-bold', atual || feito ? 'text-ink' : 'text-ink-soft')}>
                {s.nome}
                {feito && <Check aria-hidden strokeWidth={3} className="size-4 text-leaf-600" />}
                {!alcancavel && <Lock aria-hidden className="size-3.5 text-ink-mute/70" />}
              </span>
              <span className={cn('text-sm leading-snug', resumo ? 'text-ink-soft' : 'text-ink-mute italic')}>
                {resumo ?? (atual ? 'a responder agora…' : 'por responder')}
              </span>
            </span>
          </>
        )
        const base = 'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors'
        return (
          <li key={s.id} className="relative">
            {/* fio que liga os passos */}
            {i < PASSOS.length - 1 && (
              <span aria-hidden className="absolute top-11 bottom-0 left-[1.6rem] w-px border-l border-dashed border-line-strong" />
            )}
            {atual ? (
              <div aria-current="step" className={cn(base, 'relative bg-white shadow-soft ring-1 ring-line')}>
                {conteudo}
              </div>
            ) : alcancavel ? (
              <button
                type="button"
                onClick={() => onIrPara(i)}
                className={cn(base, 'min-h-12 hover:bg-white/70')}
                aria-label={`Passo ${i + 1}, ${s.nome}${typeof resumo === 'string' ? `: ${resumo}` : ''}. Alterar.`}
              >
                {conteudo}
              </button>
            ) : (
              <div className={cn(base, 'opacity-80')} aria-disabled="true">
                {conteudo}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Quantas instituições continuam a servir este retrato, requisito a requisito. */
export function FunilRetrato({ r, lares, className }: { r: Rascunho; lares: Lar[]; className?: string }) {
  const f = funil(lares, r)
  const nenhum = f.etapas.length > 0 && f.final === 0
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="flex items-baseline gap-2.5">
        <span className={cn('font-display text-4xl leading-none font-semibold tabular', nenhum ? 'text-terra-700' : 'text-pine-800')}>
          {f.final}
        </span>
        <span className="text-sm leading-snug text-ink-soft">
          {f.etapas.length === 0
            ? `instituições residenciais no EncontraLar, por todo o país`
            : f.final === 1
              ? `instituição serve este retrato, de ${f.total} no país`
              : `instituições servem este retrato, de ${f.total} no país`}
        </span>
      </p>
      {f.etapas.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Como cada resposta reduz as opções">
          {f.etapas.map((e) => (
            <li key={e.chave} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span className="truncate text-ink-soft">{e.label}</span>
              <span className="font-bold text-ink tabular">{e.n}</span>
              <span aria-hidden className="col-span-2 h-1.5 overflow-hidden rounded-full bg-sand-deep">
                <span
                  className={cn('block h-full rounded-full transition-[width] duration-500', e.n === 0 ? 'bg-terra-500' : 'bg-pine-500')}
                  style={{ width: `${Math.max(e.n ? 3 : 0, (e.n / Math.max(1, f.total)) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {nenhum && (
        <p className="text-sm text-terra-800">Nenhuma por agora — no fim mostramos o que está a limitar e como alargar.</p>
      )}
    </div>
  )
}

/** Cartão lateral (desktop): retrato + índice dos passos + funil. */
export function RetratoRail({
  r,
  passo,
  alcancado,
  onIrPara,
  lares,
}: {
  r: Rascunho
  passo: number
  alcancado: number
  onIrPara: (i: number) => void
  lares: Lar[]
}) {
  const p = pessoa(r)
  const idade = idadeNum(r)
  const titulo = r.relacao
    ? p.proprio
      ? r.nome.trim()
        ? `${r.nome.trim().split(/\s+/)[0]}${idade != null ? `, ${idade} anos` : ''}`
        : `O seu retrato${idade != null ? `, ${idade} anos` : ''}`
      : p.primeiroNome
        ? `${p.primeiroNome}${idade != null ? `, ${idade} anos` : ''}`
        : `${p.A}${idade != null ? `, ${idade} anos` : ''}`
    : 'Ainda por conhecer'
  const sub = r.relacao && !p.proprio && p.primeiroNome ? p.A : r.relacao ? null : 'Vai ganhando forma a cada resposta.'

  return (
    <aside aria-label="Retrato e passos do questionário" className="overflow-hidden rounded-4xl border border-line bg-sand shadow-soft">
      <AzulejoBand className="h-14 border-b border-line" color="#1d564e" opacity={0.28} size={44} />
      <div className="flex items-end gap-4 px-6 pb-2">
        <Medalhao r={r} className="-mt-10" />
        <div className="min-w-0 pb-1">
          <p className="eyebrow">Retrato</p>
          <p className="truncate font-display text-xl leading-tight font-semibold text-ink">{titulo}</p>
          {sub && <p className="truncate text-sm text-ink-soft">{sub}</p>}
        </div>
      </div>
      <IndicePassos r={r} passo={passo} alcancado={alcancado} onIrPara={onIrPara} className="px-3 pt-2 pb-3" />
      <div className="border-t border-dashed border-line-strong bg-cream/60 px-6 py-5">
        <FunilRetrato r={r} lares={lares} />
      </div>
    </aside>
  )
}
