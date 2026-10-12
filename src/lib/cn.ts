import { twMerge } from 'tailwind-merge'

/**
 * Junta classes condicionalmente e resolve conflitos do Tailwind (a última ganha):
 * cn('min-h-12 px-4', cond && 'min-h-11') → "px-4 min-h-11"
 */
export function cn(...parts: unknown[]): string {
  return twMerge(parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' '))
}
