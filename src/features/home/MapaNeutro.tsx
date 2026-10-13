import { memo, useMemo } from 'react'
import type { Lar } from '@/types'
import { PortugalMap } from '@/components/brand/PortugalMap'
import { PT_VIEWBOX, projectPT } from '@/data/portugal-shape'
import { cn } from '@/lib/cn'

/** O mapa base recebe sempre a mesma lista vazia (o PortugalMap é memo: um [] novo obrigava a redesenhá-lo). */
const SEM_INSTITUICOES: Lar[] = []

/**
 * Nomes das cidades, por cima dos pontos: as mesmas posições e o mesmo estilo do PortugalMap (que os desenha por
 * cima dos seus pontos; aqui os pontos são uma camada à parte, por isso os nomes vêm com eles).
 */
const CIDADES = [
  { nome: 'Porto', lat: 41.15, lng: -8.61, dx: -10, anchor: 'end' },
  { nome: 'Coimbra', lat: 40.21, lng: -8.43, dx: -10, anchor: 'end' },
  { nome: 'Lisboa', lat: 38.72, lng: -9.14, dx: -22, anchor: 'end' },
  { nome: 'Évora', lat: 38.57, lng: -7.91, dx: 10, anchor: 'start' },
  { nome: 'Faro', lat: 37.02, lng: -7.93, dx: 10, anchor: 'start' },
  { nome: 'Braga', lat: 41.55, lng: -8.42, dx: 10, anchor: 'start' },
] as const

/**
 * Pontos das instituições sem estado de vaga: todos iguais (grafite), por ordem geográfica. Nem a cor, nem o
 * tamanho, nem a ordem no DOM dizem quais têm vaga — o PortugalMap pinta cada ponto pela disponibilidade, por isso
 * na versão grátis desenha só o fundo, e estes pontos vão por cima, com o mesmo viewBox.
 */
const Pontos = memo(function Pontos({ lares, labels }: { lares: Lar[]; labels: boolean }) {
  const pontos = useMemo(() => lares.map((l) => projectPT(l.lat, l.lng)).sort((a, b) => a.y - b.y || a.x - b.x), [lares])
  return (
    <svg
      aria-hidden
      viewBox={`${PT_VIEWBOX.x} ${PT_VIEWBOX.y} ${PT_VIEWBOX.w} ${PT_VIEWBOX.h}`}
      className="pointer-events-none absolute inset-0 block size-full"
    >
      {pontos.map((p, i) => (
        // cor sólida (sem transparência): com sobreposições, dois tons pareceriam duas categorias
        <circle key={i} cx={p.x} cy={p.y} r="3.4" fill="#48484a" stroke="#fff" strokeWidth="1.2" />
      ))}
      {labels &&
        CIDADES.map((c) => {
          const p = projectPT(c.lat, c.lng)
          return (
            <text
              key={c.nome}
              x={p.x + c.dx}
              y={p.y + 4}
              textAnchor={c.anchor}
              fill="#86868b"
              fontSize="11.5"
              fontWeight="500"
              fontFamily="'Inter Variable', sans-serif"
              paintOrder="stroke"
              stroke="#fff"
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {c.nome}
            </text>
          )
        })}
    </svg>
  )
})

/**
 * Mapa de Portugal em pontos para a versão grátis (sem Acesso Família): mostra onde há instituições, não quais
 * têm vaga. O título (`role="img"`) deve ter só contagens agregadas.
 */
export function MapaNeutro({ lares, title, labels = true, className }: { lares: Lar[]; title: string; labels?: boolean; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <PortugalMap lares={SEM_INSTITUICOES} labels={false} pulse={false} title={title} />
      <Pontos lares={lares} labels={labels} />
    </div>
  )
}
