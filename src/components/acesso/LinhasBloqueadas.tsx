import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { linkAcesso } from '@/lib/acesso'
import { cn } from '@/lib/cn'
import { ACESSO_CTA, ACESSO_DESDE, ACESSO_DISPONIVEL, ACESSO_PARA_LARES } from './texto'
import { useEhInstituicao, useVoltarAtual } from './useVoltarAtual'

export interface LinhasBloqueadasProps {
  /** quantas linhas de exemplo (só formas, sem dados) */
  n?: number
  /** o que a lista mostraria, ex.: "Que instituições têm vaga e quantos lugares" */
  rotulo?: ReactNode
  /** para onde voltar depois de ativar (por omissão, a rota atual) */
  voltar?: string
  className?: string
}

// larguras fixas (não aleatórias): a mesma lista em cada visita e nada de saltos ao voltar a desenhar
const LARGURAS = [
  ['w-[62%]', 'w-[38%]', 'w-16'],
  ['w-[48%]', 'w-[30%]', 'w-12'],
  ['w-[56%]', 'w-[42%]', 'w-14'],
  ['w-[44%]', 'w-[26%]', 'w-16'],
] as const

/**
 * Lista de "provas" para a versão grátis: linhas com a forma do conteúdo (miniatura, duas linhas, etiqueta) mas
 * SEM dados reais, com um cartão centrado por cima e "Ver o Acesso Família". Estático (sem brilho a passar):
 * respeita o movimento reduzido. As formas são decorativas (aria-hidden); o cartão diz o que está fechado.
 */
export function LinhasBloqueadas({ n = 3, rotulo, voltar, className }: LinhasBloqueadasProps) {
  const atual = useVoltarAtual()
  const instituicao = useEhInstituicao()
  const linhas = Math.max(1, Math.min(n, 8))

  return (
    // grelha com as duas camadas na mesma célula: a altura é a maior das duas (o cartão nunca transborda)
    <div className={cn('grid', className)}>
      {/* a máscara cria um contexto de empilhamento: sem pointer-events-none e sem z-index no cartão, as formas
          ficavam por cima do botão (não clicável em telemóvel) */}
      <ul aria-hidden className="pointer-events-none col-start-1 row-start-1 flex flex-col gap-2 [mask-image:linear-gradient(to_bottom,#000_35%,transparent)]">
        {Array.from({ length: linhas }, (_, i) => {
          const [a, b, c] = LARGURAS[i % LARGURAS.length]!
          return (
            <li key={i} className="flex items-center gap-4 rounded-3xl p-3">
              <span className="aspect-[4/3] w-16 shrink-0 rounded-2xl bg-ink/[0.06] sm:w-20" />
              <span className="flex min-w-0 flex-1 flex-col gap-2.5">
                <span className={cn('h-3.5 rounded-full bg-ink/[0.08]', a)} />
                <span className={cn('h-3 rounded-full bg-ink/[0.05]', b)} />
              </span>
              <span className={cn('h-7 shrink-0 rounded-full bg-ink/[0.06]', c)} />
            </li>
          )
        })}
      </ul>

      <div className="relative z-10 col-start-1 row-start-1 flex items-center justify-center p-3">
        <div className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-white px-6 py-6 text-center shadow-card ring-1 ring-black/5">
          <Lock aria-hidden className="size-5 text-ink-soft" />
          <p className="mt-3 font-semibold text-ink">{rotulo ?? (instituicao ? ACESSO_PARA_LARES : ACESSO_DISPONIVEL)}</p>
          {instituicao ? (
            rotulo != null && <p className="mt-1 text-sm text-ink-mute">{ACESSO_PARA_LARES}</p>
          ) : (
            <>
              {rotulo != null && <p className="mt-1 text-sm text-ink-mute">{ACESSO_DISPONIVEL}.</p>}
              <ButtonLink to={linkAcesso(voltar ?? atual)} variant="primary" className="mt-5 max-sm:w-full">
                {ACESSO_CTA}
              </ButtonLink>
              <p className="mt-2 text-sm text-ink-mute">{ACESSO_DESDE}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
