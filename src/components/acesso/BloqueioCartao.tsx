import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { linkAcesso } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { ACESSO_CTA, ACESSO_DESDE, ACESSO_DISPONIVEL, ACESSO_PARA_LARES } from './texto'
import { useEhInstituicao, useVoltarAtual } from './useVoltarAtual'

export interface BloqueioCartaoProps {
  /** o que está fechado, ex.: "Vagas, preços e previsão de espera" */
  titulo: ReactNode
  /** frase curta; por omissão "Disponível com o Acesso Família." */
  texto?: ReactNode
  /** para onde voltar depois de ativar (por omissão, a rota atual) */
  voltar?: string
  /** numa linha (dentro de secções e cartões) */
  compacto?: boolean
  className?: string
}

/**
 * O bloco "fechado" padrão da versão grátis: cadeado, o que está fechado, uma frase e "Ver o Acesso Família".
 * Faz parte do desenho (tile cinza, calmo), não é um erro. Nunca leva os dados reais por baixo.
 * Para uma instituição (role 'lar') mostra só "Informação para famílias com Acesso Família.", sem botão.
 */
export function BloqueioCartao({ titulo, texto, voltar, compacto = false, className }: BloqueioCartaoProps) {
  const atual = useVoltarAtual()
  const instituicao = useEhInstituicao()
  const frase = instituicao ? ACESSO_PARA_LARES : (texto ?? `${ACESSO_DISPONIVEL}.`)
  const cta = !instituicao && (
    <ButtonLink to={linkAcesso(voltar ?? atual)} variant="primary" size={compacto ? 'sm' : 'md'} className={cn(compacto && 'min-h-11', 'max-sm:w-full')}>
      {ACESSO_CTA}
    </ButtonLink>
  )

  if (compacto) {
    // numa linha quando cabe (texto com pelo menos 16rem), senão o botão passa para baixo: depende do espaço do
    // próprio bloco (pode estar numa coluna estreita), não da largura do ecrã
    return (
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl bg-sand p-5', className)}>
        <div className="flex min-w-0 flex-[1_1_16rem] items-start gap-3">
          <Lock aria-hidden className="mt-1 size-4 shrink-0 text-ink-mute" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{titulo}</p>
            <p className="text-sm text-ink-mute">{frase}</p>
          </div>
        </div>
        {cta && (
          <div className="flex shrink-0 flex-col items-center gap-1 max-sm:w-full">
            {cta}
            <span className="text-sm text-ink-mute">{ACESSO_DESDE}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-start rounded-3xl bg-sand p-6 sm:p-8', className)}>
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-white text-ink-soft">
        <Lock className="size-4.5" />
      </span>
      <p className="mt-4 text-xl font-semibold tracking-tight text-ink">{titulo}</p>
      <p className="mt-1 max-w-md text-ink-mute">{frase}</p>
      {cta && (
        <div className="mt-6 flex w-full flex-wrap items-center gap-x-4 gap-y-2">
          {cta}
          <span className="text-sm text-ink-mute max-sm:w-full max-sm:text-center">{ACESSO_DESDE}</span>
        </div>
      )}
    </div>
  )
}
