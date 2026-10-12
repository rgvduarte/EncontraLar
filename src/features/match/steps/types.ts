import type { Lar } from '@/types'
import type { Erros, Rascunho } from '../model'
import type { Pessoa } from '../language'

export interface StepProps {
  r: Rascunho
  patch: (p: Partial<Rascunho>) => void
  erros: Erros
  lares: Lar[]
  p: Pessoa
}
