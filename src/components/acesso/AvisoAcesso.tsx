import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Lock } from 'lucide-react'
import { linkAcesso } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { ACESSO_CTA } from './texto'
import { useEhInstituicao, useVoltarAtual } from './useVoltarAtual'

export interface AvisoAcessoProps {
  /** o que está fechado, numa frase: "Que instituições têm vaga: disponível com o Acesso Família." */
  texto: ReactNode
  /** para onde voltar depois de ativar (por omissão, a rota atual) */
  voltar?: string
  className?: string
}

/**
 * Convite numa linha: cadeado + frase + "Ver o Acesso Família ›". Discreto, para o fim de listas e secções.
 * Instituições (role 'lar') veem só a frase.
 */
export function AvisoAcesso({ texto, voltar, className }: AvisoAcessoProps) {
  const atual = useVoltarAtual()
  const instituicao = useEhInstituicao()
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 text-sm text-ink-mute', className)}>
      {/* o cadeado vai em linha com o texto: numa frase que quebra, fica na primeira linha */}
      <p className="flex min-h-11 items-center py-1.5">
        <span>
          <Lock aria-hidden className="mr-2 inline size-4 align-[-0.15em]" />
          {texto}
        </span>
      </p>
      {!instituicao && (
        <Link
          to={linkAcesso(voltar ?? atual)}
          className="group inline-flex min-h-11 items-center gap-0.5 font-medium whitespace-nowrap text-terra-600 transition-colors hover:text-terra-700"
        >
          {ACESSO_CTA}
          <ChevronRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
