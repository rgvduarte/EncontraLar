import { cn } from '@/lib/cn'

/**
 * Linha discreta no fim de /encontrar, que não tem rodapé: aviso de protótipo + crédito,
 * com o mesmo tom do rodapé global (texto pequeno, cinza, ligação sem sublinhado).
 */
export function NotaFinal({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center justify-center gap-x-2 text-xs text-ink-mute', className)}>
      <span>Protótipo — dados fictícios</span>
      <span aria-hidden>·</span>
      <a
        href="https://www.buildity.pt"
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-12 items-center transition-colors duration-200 hover:text-ink"
      >
        by Buildity
        <span className="sr-only"> (abre num novo separador)</span>
      </a>
    </p>
  )
}
