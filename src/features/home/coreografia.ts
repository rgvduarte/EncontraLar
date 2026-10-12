import type { CSSProperties } from 'react'

/**
 * Estilo de uma entrada da coreografia (classe `hm-in`, ver home-motion.css): animação, duração e atraso em ms.
 * Ex.: <p className="hm-in" style={entrada(240, 'hm-rise')}>
 */
export function entrada(atraso: number, anim = 'hm-blur-up', duracao = 1000): CSSProperties {
  return { '--hm-a': anim, '--hm-t': `${duracao}ms`, '--hm-d': `${Math.round(atraso)}ms` } as CSSProperties
}

/** Curva "Apple" para as transições escritas em JS/CSS inline. */
export const EASE = 'cubic-bezier(.16,1,.3,1)'
