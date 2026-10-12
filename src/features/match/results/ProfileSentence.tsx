import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import { partesResumo } from '../language'
import type { Rascunho } from '../model'

/**
 * O perfil numa frase calma ("Para a sua mãe, 84 anos, com dependência moderada…"), em que cada parte
 * é uma ligação para alterar o passo correspondente. São ligações (e não botões) para poderem partir linha.
 */
export function ProfileSentence({ r, onAlterar, className }: { r: Rascunho; onAlterar: (passo: number) => void; className?: string }) {
  const partes = partesResumo(r)
  return (
    <p className={cn('text-lg leading-relaxed text-ink-mute sm:text-2xl sm:leading-relaxed', className)}>
      {partes.map((pt, i) => (
        <Fragment key={pt.passo}>
          <a
            href="#/encontrar"
            onClick={(e) => {
              e.preventDefault()
              onAlterar(pt.passo)
            }}
            title={`Alterar ${pt.oQue}`}
            className="rounded-md text-ink underline decoration-line-strong decoration-1 underline-offset-[6px] transition-colors duration-200 hover:text-terra-600 hover:decoration-terra-600"
          >
            <span className="sr-only">Alterar {pt.oQue}: </span>
            {pt.texto}
          </a>
          {i < partes.length - 1 ? ', ' : '.'}
        </Fragment>
      ))}
    </p>
  )
}
