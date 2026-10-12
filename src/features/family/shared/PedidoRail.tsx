import { Check, X } from 'lucide-react'
import type { Candidatura } from '@/types'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ESTADO_META, PASSOS } from './estado'

/**
 * "Linha" do pedido — como uma linha de comboio com cinco estações, do pedido à entrada.
 * Estações cumpridas a verde-pinho, a atual em terracota, as seguintes tracejadas.
 */
export function PedidoRail({ c, compact = false, className }: { c: Candidatura; compact?: boolean; className?: string }) {
  const meta = ESTADO_META[c.estado]
  const terminado = meta.passo == null
  // num pedido terminado, a última estação alcançada vem do histórico
  const alcancado = terminado
    ? Math.max(0, ...c.historico.map((h) => ESTADO_META[h.estado].passo ?? 0))
    : (meta.passo as number)
  const ultimo = PASSOS.length - 1
  const progresso = alcancado / ultimo

  return (
    <div className={className}>
      <div className="relative">
        {/* carril */}
        <div aria-hidden className="absolute top-3.5 right-[10%] left-[10%] h-0.5 border-t-2 border-dashed border-line-strong" />
        <div
          aria-hidden
          className={cn('absolute top-[13px] left-[10%] h-[3px] rounded-full', terminado ? 'bg-ink-mute/50' : 'bg-pine-600')}
          style={{ width: `${progresso * 80}%` }}
        />
        <ol className="relative grid grid-cols-5" aria-label="Progresso do pedido">
          {PASSOS.map((label, i) => {
            const feito = i < alcancado || (!terminado && i === alcancado && c.estado === 'aceite')
            const atual = i === alcancado
            const estadoTxt = terminado
              ? i <= alcancado
                ? atual
                  ? `interrompido: ${ESTADO_CANDIDATURA_LABEL[c.estado].toLowerCase()}`
                  : 'concluído'
                : 'não alcançado'
              : feito
                ? 'concluído'
                : atual
                  ? 'etapa atual'
                  : 'por acontecer'
            return (
              <li key={label} className="flex flex-col items-center gap-1.5" aria-current={atual && !terminado ? 'step' : undefined}>
                <span
                  aria-hidden
                  className={cn(
                    'relative flex items-center justify-center rounded-full border-2 transition-colors',
                    atual ? 'size-7.5' : 'size-7',
                    terminado && atual && 'border-ink-mute bg-white text-ink-mute',
                    terminado && !atual && i < alcancado && 'border-ink-mute/60 bg-ink-mute/60 text-white',
                    terminado && i > alcancado && 'border-line-strong bg-cream',
                    !terminado && feito && 'border-pine-700 bg-pine-700 text-white',
                    !terminado && atual && !feito && 'border-terra-600 bg-terra-600 text-white shadow-[0_0_0_5px_var(--color-terra-100)]',
                    !terminado && !feito && !atual && 'border-line-strong bg-white',
                  )}
                >
                  {terminado && atual ? (
                    <X strokeWidth={3} className="size-4" />
                  ) : feito || (terminado && i < alcancado) ? (
                    <Check strokeWidth={3} className="size-4" />
                  ) : atual ? (
                    <span className="size-2 rounded-full bg-white" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-center text-xs leading-tight',
                    compact ? 'sr-only' : 'hidden sm:block',
                    atual && !terminado ? 'font-bold text-terra-800' : feito ? 'font-semibold text-ink-soft' : 'text-ink-mute',
                  )}
                >
                  {label}
                  <span className="sr-only">: {estadoTxt}</span>
                </span>
                {!compact && (
                  <span className="sr-only sm:hidden">
                    {label}: {estadoTxt}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <p aria-hidden className={cn('mt-2 text-sm text-ink-soft', compact ? '' : 'sm:hidden')}>
        {terminado ? (
          <>Pedido terminado na etapa “{PASSOS[alcancado]}”</>
        ) : (
          <>
            Etapa {alcancado + 1} de {PASSOS.length}: <strong className="text-ink">{PASSOS[alcancado]}</strong>
          </>
        )}
      </p>
    </div>
  )
}
