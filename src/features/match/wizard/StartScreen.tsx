import { useEffect, useMemo, useRef } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import type { Lar, PerfilIdoso } from '@/types'
import { Button } from '@/components/ui/Button'
import { CountUp, Reveal } from '@/components/motion'
import { vagaParaNovos } from '@/lib/forecast'
import { num } from '@/lib/format'
import { PASSOS, primeiroIncompleto } from '../model'
import { residenciais } from '../area'
import { NotaFinal } from '../NotaFinal'
import type { AcoesSessao, Sessao } from '../useMatchSession'

/**
 * Ecrã de entrada: uma frase, uma ação. Retoma respostas a meio ou um perfil já guardado.
 * Coreografia: o título "foca" (desfoque → nítido), depois a frase, a ação e as notas, em cascata.
 */
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
  // o questionário só sugere respostas residenciais (lares e residências; sem centros de dia)
  const res = useMemo(() => residenciais(lares), [lares])
  // "com vaga agora" = vaga para quem pede hoje (lugares livres já prometidos à lista de espera não contam)
  const comVaga = useMemo(() => res.filter((l) => vagaParaNovos(l)).length, [res])
  const completo = emCurso && primeiroIncompleto(sessao.r) === -1

  useEffect(() => {
    h1.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
      <section className="container-page flex flex-1 flex-col items-center justify-center pt-16 pb-10 text-center sm:py-28">
        <Reveal variant="blur" duration={1100}>
          <p className="eyebrow">Ajuda-me a escolher</p>
          <h1
            ref={h1}
            tabIndex={-1}
            className="mx-auto mt-4 max-w-5xl font-display text-[2.5rem] leading-[1.05] font-semibold text-ink outline-none sm:text-6xl"
          >
            <span className="block">Diga-nos quem é.</span>{' '}
            <span className="block">
              Mostramos onde há <em>lugar</em>.
            </span>
          </h1>
        </Reveal>
        <Reveal delay={140} duration={900}>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-balance text-ink-mute sm:max-w-[50rem] sm:text-2xl">
            Seis perguntas, cerca de três minutos. Sem criar conta.
          </p>
        </Reveal>

        {/* ação ao alcance do polegar: largura total no telemóvel */}
        <Reveal
          delay={260}
          duration={900}
          className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center"
        >
          {emCurso ? (
            <>
              {completo ? (
                <Button size="lg" onClick={acoes.verResultados} iconRight={<ChevronRight aria-hidden />} className="px-8">
                  Ver as sugestões
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => acoes.irPara(sessao.passo)}
                  iconRight={<ChevronRight aria-hidden />}
                  className="px-8"
                >
                  Continuar no passo {sessao.passo + 1}
                </Button>
              )}
              <Button variant="subtle" size="lg" onClick={acoes.recomecar} icon={<RotateCcw aria-hidden />}>
                Recomeçar
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => acoes.irPara(0)} iconRight={<ChevronRight aria-hidden />} className="px-10">
              Começar
            </Button>
          )}
        </Reveal>
        <Reveal variant="fade" delay={380}>
          <p className="mt-4 text-sm text-ink-mute">
            {completo
              ? 'Já respondeu a tudo. As respostas estão guardadas neste separador.'
              : emCurso
              ? `Ficou em «${PASSOS[sessao.passo]!.nome}». As respostas estão guardadas neste separador.`
              : 'As respostas ficam só neste separador até decidir guardá-las.'}
          </p>
        </Reveal>

        {perfis.length > 0 && (
          <Reveal delay={460} className="mt-12 flex flex-col items-center gap-3">
            <p className="text-sm text-ink-mute">Ou use um perfil que já guardou</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {perfis.map((pf) => (
                <li key={pf.id}>
                  <button
                    type="button"
                    onClick={() => acoes.usarPerfil(pf)}
                    className="link inline-flex min-h-12 items-center gap-0.5 rounded-full px-3 text-lg active:opacity-60"
                  >
                    Usar o perfil de {pf.nome}
                    <ChevronRight aria-hidden className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        <Reveal variant="fade" delay={560} className="mt-14 sm:mt-16">
          <p className="max-w-xs text-sm text-balance text-ink-mute sm:max-w-none">
            {/* ponto em linha com o texto (não em flex): ao partir linha, fica junto do número */}
            <span aria-hidden className="pulse-dot mr-2 mb-0.5 inline-block size-2 rounded-full bg-leaf-500 align-middle" />
            <span>
              <span aria-hidden>
                <CountUp value={comVaga} duration={1200} className="font-medium text-ink tabular" />
              </span>
              <span className="sr-only">{num(comVaga)}</span> com vaga agora, entre {num(res.length)} lares e residências
            </span>
          </p>
        </Reveal>
      </section>
      <NotaFinal className="container-page pb-[calc(0.25rem+env(safe-area-inset-bottom))]" />
    </div>
  )
}
