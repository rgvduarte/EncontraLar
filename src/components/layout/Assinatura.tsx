import { cn } from '@/lib/cn'

/**
 * Assinatura discreta para páginas sem rodapé (pesquisa, questionário): aviso de protótipo + crédito.
 * O rodapé global tem a sua própria versão.
 */
export function Assinatura({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-ink-mute', className)}>
      Protótipo · instituições e dados fictícios ·{' '}
      <a href="https://www.buildity.pt" target="_blank" rel="noopener" className="inline-flex min-h-12 items-center transition-colors hover:text-ink">
        by Buildity
        <span className="sr-only"> (abre num novo separador)</span>
      </a>
    </p>
  )
}
