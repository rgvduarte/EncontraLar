import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Superfície branca com contorno subtil (minimalista: sem sombras pesadas). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[1.75rem] border border-line bg-white', className)} {...rest} />
}

export function CardSection({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 sm:p-8', className)} {...rest} />
}
