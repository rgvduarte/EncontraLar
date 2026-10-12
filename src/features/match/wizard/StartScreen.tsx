import { useEffect, useMemo, useRef } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import type { Lar, PerfilIdoso } from '@/types'
import { Button } from '@/components/ui/Button'
import { vagasLivres } from '@/lib/forecast'
import { num } from '@/lib/format'
import { PASSOS } from '../model'
import { residenciais } from '../area'
import type { AcoesSessao, Sessao } from '../useMatchSession'

/** Ecrã de entrada: uma frase, uma ação. Retoma respostas a meio ou um perfil já guardado. */
export function StartScreen({
  sessao,
  acoes,
  lares,
  perfis,
  emCurso,
}: {
  sessao: Sessao
  acoes: AcoesSessao
  lares: Lar[]
  perfis: PerfilIdoso[]
  emCurso: boolean
}) {
  const h1 = useRef<HTMLHeadingElement>(null)
  const res = useMemo(() => residenciais(lares), [lares])
  const comVaga = useMemo(() => res.filter((l) => vagasLivres(l) > 0).length, [res])

  useEffect(() => {
    h1.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
      <section className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-28">
        <div className="animate-fade-up">
          <p className="eyebrow">Ajuda-me a escolher</p>
          <h1
            ref={h1}
            tabIndex={-1}
            className="mx-auto mt-4 max-w-5xl font-display text-[2.75rem] leading-[1.04] font-semibold text-ink outline-none sm:text-6xl"
          >
            Diga-nos quem é. <br className="hidden sm:block" />
            Mostramos onde há <em>lugar</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-ink-mute sm:text-2xl">
            Seis perguntas, cerca de três minutos. Sem criar conta.
          </p>
        </div>

        <div className="mt-10 flex animate-fade-up flex-col items-center gap-3 [animation-delay:120ms] sm:flex-row sm:justify-center">
          {emCurso ? (
            <>
              <Button
                size="lg"
                onClick={() => acoes.irPara(sessao.passo)}
                iconRight={<ChevronRight aria-hidden />}
                className="px-8"
              >
                Continuar no passo {sessao.passo + 1}
              </Button>
              <Button variant="subtle" size="lg" onClick={acoes.recomecar} icon={<RotateCcw aria-hidden />}>
                Recomeçar
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => acoes.irPara(0)} iconRight={<ChevronRight aria-hidden />} className="px-10">
              Começar
            </Button>
          )}
        </div>
        <p className="mt-4 animate-fade-in text-sm text-ink-mute">
          {emCurso
            ? `Ficou em «${PASSOS[sessao.passo]!.nome}». As respostas estão guardadas neste separador.`
            : 'As respostas ficam só neste separador até decidir guardá-las.'}
        </p>

        {perfis.length > 0 && (
          <div className="mt-12 flex animate-fade-up flex-col items-center gap-3 [animation-delay:200ms]">
            <p className="text-sm text-ink-mute">Ou use um perfil que já guardou</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {perfis.map((pf) => (
                <li key={pf.id}>
                  <button
                    type="button"
                    onClick={() => acoes.usarPerfil(pf)}
                    className="link inline-flex min-h-12 items-center gap-0.5 rounded-full px-3 text-lg"
                  >
                    Usar o perfil de {pf.nome}
                    <ChevronRight aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-16 inline-flex animate-fade-in items-center gap-2 text-sm text-ink-mute [animation-delay:300ms]">
          <span aria-hidden className="size-2 animate-pulse-ring rounded-full bg-leaf-500" />
          <span>
            <span className="font-medium text-ink tabular">{num(comVaga)}</span> com vaga agora, entre {num(res.length)}{' '}
            instituições
          </span>
        </p>
      </section>
    </div>
  )
}
