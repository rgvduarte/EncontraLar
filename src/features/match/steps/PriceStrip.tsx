import { useMemo } from 'react'
import { euro } from '@/lib/format'
import { cn } from '@/lib/cn'
import { posicaoCursor } from '../controls/RangeSlider'
import type { PontoPreco } from '../area'

const NIVEIS = 4
const ALTURA_NIVEL = 14

/**
 * Distribuição das mensalidades da zona, desenhada na MESMA escala da régua por baixo:
 * cada ponto é uma instituição; cheio = cabe no orçamento.
 */
export function PriceStrip({
  pontos,
  min,
  max,
  orcamento,
  mediana,
}: {
  pontos: PontoPreco[]
  min: number
  max: number
  orcamento: number
  mediana: number | null
}) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min)
  // "enxame" simples: empilha pontos demasiado próximos
  const colocados = useMemo(() => {
    const folga = (max - min) * 0.022
    const ultimo: number[] = Array(NIVEIS).fill(-Infinity)
    return [...pontos]
      .sort((a, b) => a.preco - b.preco)
      .map((p) => {
        const v = Math.min(max, Math.max(min, p.preco))
        let nivel = ultimo.findIndex((u) => v - u >= folga)
        if (nivel === -1) nivel = ultimo.indexOf(Math.min(...ultimo))
        ultimo[nivel] = v
        return { ...p, nivel, f: frac(v) }
      })
  }, [pontos, min, max])

  const fMed = mediana != null ? frac(mediana) : null
  const fOrc = frac(orcamento)

  return (
    <div aria-hidden className="relative" style={{ height: NIVEIS * ALTURA_NIVEL + 40 }}>
      {fMed != null && (
        <div className="absolute top-0 bottom-0" style={{ left: posicaoCursor(fMed) }}>
          <span className="absolute bottom-0 left-0 h-[calc(100%-1.6rem)] border-l-2 border-dashed border-pine-800/50" />
          <span
            className={cn(
              'absolute top-0 rounded-full bg-pine-800 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white',
              fMed > 0.7 ? '-translate-x-full' : fMed < 0.15 ? '' : '-translate-x-1/2',
            )}
          >
            mediana dos privados · {euro(mediana!)}
          </span>
        </div>
      )}
      <span
        className="absolute bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-terra-500 transition-[left] duration-150"
        style={{ left: posicaoCursor(fOrc), height: NIVEIS * ALTURA_NIVEL + 12 }}
      />
      {colocados.map((p) => {
        const dentro = p.preco <= orcamento
        return (
          <span
            key={p.id}
            className={cn(
              'absolute size-3 -translate-x-1/2 border-2 transition-colors duration-150',
              p.privado ? 'rounded-full' : 'rotate-45 rounded-[2px]',
              dentro ? 'border-pine-700 bg-pine-600' : 'border-line-strong bg-white',
            )}
            style={{ left: posicaoCursor(p.f), bottom: 4 + p.nivel * ALTURA_NIVEL }}
          />
        )
      })}
    </div>
  )
}

export function PriceStripLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="size-3 rounded-full border-2 border-pine-700 bg-pine-600" />
        Privado
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="size-2.5 rotate-45 rounded-[2px] border-2 border-pine-700 bg-pine-600" />
        IPSS ou Misericórdia (valor mínimo)
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="size-3 rounded-full border-2 border-line-strong bg-white" />
        Vazio = acima do orçamento
      </li>
    </ul>
  )
}
