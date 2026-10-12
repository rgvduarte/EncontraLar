import type { CSSProperties, HTMLAttributes } from 'react'

/**
 * DESCONTINUADO — a direção visual passou a ser minimalista (ver docs/DESIGN.md).
 * Mantido apenas para não partir importações antigas; não renderiza nada. Não usar em código novo.
 */
export function azulejoBg(..._args: unknown[]): CSSProperties {
  return {}
}
export function AzulejoBand(_props: HTMLAttributes<HTMLDivElement> & { color?: string; opacity?: number; size?: number }) {
  return null
}
export function CalcadaDivider(_props: { color?: string; bg?: string; height?: number; className?: string }) {
  return null
}
export function calcadaStonesBg(..._args: unknown[]): CSSProperties {
  return {}
}
