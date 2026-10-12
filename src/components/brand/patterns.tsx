import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** Azulejo português (padrão de 4 quartos com flor central) como background CSS. */
export function azulejoBg(color = '#1d564e', opacity = 1, size = 56): CSSProperties {
  const c = color
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='none' stroke='${c}' stroke-width='1.6' opacity='${opacity}'><path d='M0 0h56v56H0z' stroke-opacity='.35'/><path d='M28 6c6 8 6 14 0 22-6-8-6-14 0-22zM28 50c6-8 6-14 0-22-6 8-6 14 0 22zM6 28c8-6 14-6 22 0-8 6-14 6-22 0zM50 28c-8-6-14-6-22 0 8 6 14 6 22 0z'/><circle cx='28' cy='28' r='3.2' fill='${c}'/><path d='M0 9a9 9 0 0 0 9-9M47 0a9 9 0 0 0 9 9M56 47a9 9 0 0 0-9 9M9 56a9 9 0 0 0-9-9'/><path d='M0 15a15 15 0 0 0 15-15M41 0a15 15 0 0 0 15 15M56 41a15 15 0 0 0-15 15M15 56A15 15 0 0 0 0 41' stroke-opacity='.5'/></g></svg>`
  return { backgroundImage: enc(svg), backgroundSize: `${size}px ${size}px` }
}

/** Faixa decorativa de azulejo. */
export function AzulejoBand({ color, opacity = 0.9, size = 56, className, style, ...rest }: HTMLAttributes<HTMLDivElement> & { color?: string; opacity?: number; size?: number }) {
  return <div aria-hidden className={cn('pointer-events-none', className)} style={{ ...azulejoBg(color, opacity, size), ...style }} {...rest} />
}

/** Onda da calçada portuguesa ("mar largo" do Rossio) — divisor horizontal. */
export function CalcadaDivider({ color = '#1c2a29', bg = 'transparent', height = 22, className }: { color?: string; bg?: string; height?: number; className?: string }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='22' viewBox='0 0 80 22'><path d='M0 11 C 10 1, 30 1, 40 11 S 70 21, 80 11 L80 22 L0 22Z' fill='${color}'/></svg>`
  return (
    <div
      aria-hidden
      className={cn('w-full', className)}
      style={{ height, backgroundColor: bg, backgroundImage: enc(svg), backgroundRepeat: 'repeat-x', backgroundSize: `${(80 * height) / 22}px ${height}px`, backgroundPosition: 'bottom' }}
    />
  )
}

/** Textura de calçada (pedras) muito subtil para fundos escuros. */
export function calcadaStonesBg(color = '#ffffff', opacity = 0.05): CSSProperties {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><g fill='${color}' fill-opacity='${opacity}'><rect x='2' y='3' width='9' height='8' rx='2.5'/><rect x='14' y='2' width='10' height='9' rx='3'/><rect x='27' y='4' width='10' height='7' rx='2.5'/><rect x='1' y='15' width='11' height='9' rx='3'/><rect x='15' y='14' width='8' height='10' rx='2.5'/><rect x='26' y='15' width='12' height='8' rx='3'/><rect x='3' y='28' width='9' height='9' rx='2.5'/><rect x='15' y='27' width='11' height='10' rx='3'/><rect x='29' y='28' width='8' height='9' rx='2.5'/></g></svg>`
  return { backgroundImage: enc(svg), backgroundSize: '40px 40px' }
}
