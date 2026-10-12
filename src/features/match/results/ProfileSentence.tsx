import { Fragment } from 'react'
import { PencilLine } from 'lucide-react'
import { cn } from '@/lib/cn'
import { partesResumo } from '../language'
import type { Rascunho } from '../model'

/**
 * O perfil numa frase ("Para a sua mãe, 84 anos, com dependência moderada…"), em que cada parte
 * é uma ligação para o passo correspondente. São ligações (e não botões) para poderem partir linha.
 */
export function ProfileSentence({ r, onAlterar, className }: { r: Rascunho; onAlterar: (passo: number) => void; className?: string }) {
  const partes = partesResumo(r)
  return (
    <p className={cn('font-display text-2xl leading-snug font-normal text-pine-50 sm:text-[1.9rem] sm:leading-[1.35]', className)}>
      {partes.map((pt, i) => (
        <Fragment key={pt.passo}>
          <a
            href="#/encontrar"
            onClick={(e) => {
              e.preventDefault()
              onAlterar(pt.passo)
            }}
            className="group rounded-md underline decoration-terra-300/70 decoration-dotted decoration-2 underline-offset-[7px] transition-colors hover:text-white hover:decoration-terra-300 hover:decoration-solid focus-visible:text-white"
          >
            <span className="sr-only">Alterar {pt.oQue}: </span>
            {pt.texto}
            <PencilLine
              aria-hidden
              className="ml-1 inline size-[0.7em] -translate-y-[0.1em] align-baseline text-terra-300 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </a>
          {i < partes.length - 1 ? ', ' : '.'}
        </Fragment>
      ))}
    </p>
  )
}
