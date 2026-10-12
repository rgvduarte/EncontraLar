import { useRef, type ReactNode } from 'react'
import { LogoMark } from '@/components/layout/Logo'
import { Appear } from './Appear'
import { useCampoVisivel } from './keyboard'

/**
 * Moldura das páginas de conta, ao estilo do início de sessão da Apple:
 * página branca, coluna estreita e centrada, símbolo, um título grande e (opcional) uma frase.
 *
 * Entrada em cascata (símbolo → título → frase → conteúdo, ~70 ms entre cada um); os blocos do
 * conteúdo continuam a cascata com `<Appear delay={cascade(i)}>`.
 * No telemóvel: o campo com foco fica sempre acima do teclado e abaixo do cabeçalho.
 */
export function AuthShell({
  title,
  subtitle,
  mark,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** substitui o símbolo da marca (ex.: avatar da pessoa com sessão iniciada) */
  mark?: ReactNode
  children: ReactNode
}) {
  const conteudo = useRef<HTMLDivElement>(null)
  useCampoVisivel(conteudo)

  return (
    <div className="flex-1 overflow-x-clip bg-white">
      <div className="mx-auto w-full max-w-[40rem] px-5 pt-10 pb-16 sm:pt-20 sm:pb-32">
        <div className="flex flex-col items-center text-center">
          <Appear variant="scale" duration={820}>
            {mark ?? <LogoMark className="size-12" />}
          </Appear>
          <Appear delay={70} className="mt-6">
            <h1 tabIndex={-1} className="text-[2.5rem] leading-[1.08] font-semibold text-ink outline-none sm:text-5xl lg:text-[3.25rem]">
              {title}
            </h1>
          </Appear>
          {subtitle && (
            <Appear delay={130} className="mt-3 max-w-[28rem]">
              <p className="text-lg text-ink-mute">{subtitle}</p>
            </Appear>
          )}
        </div>
        <div
          ref={conteudo}
          className="mx-auto mt-8 max-w-[28rem] sm:mt-10 [&_:is(input,select,textarea)]:scroll-mt-28 [&_:is(input,select,textarea)]:scroll-mb-36"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
