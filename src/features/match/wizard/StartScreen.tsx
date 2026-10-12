import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, Hospital, RotateCcw, UserRound } from 'lucide-react'
import type { Lar, PerfilIdoso } from '@/types'
import { Button } from '@/components/ui/Button'
import { AzulejoBand } from '@/components/brand/patterns'
import { vagasLivres } from '@/lib/forecast'
import { GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { PASSOS } from '../model'
import { residenciais } from '../area'
import type { AcoesSessao, Sessao } from '../useMatchSession'

const PORQUE: Record<(typeof PASSOS)[number]['id'], string> = {
  pessoa: 'Quem é, e que idade tem — para falarmos da pessoa certa.',
  autonomia: 'O grau de dependência decide que lares a podem receber.',
  saude: 'Demência, acamado, enfermagem 24 horas: o que é essencial e o que só conta a favor.',
  local: 'Perto de quem vai visitar. Mostramos quantas instituições há à volta.',
  orcamento: 'O que é possível pagar, comparado com os preços reais da zona.',
  quando: 'Alta hospitalar, ou há tempo? E o que mais importa no dia a dia.',
}

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
    <div className="relative flex-1 overflow-hidden">
      <div className="container-page grid gap-12 pt-12 pb-20 lg:grid-cols-12 lg:gap-16 lg:pt-20 lg:pb-28">
        <div className="flex flex-col lg:col-span-7">
          <p className="eyebrow">Ajuda-me a escolher</p>
          <h1 ref={h1} tabIndex={-1} className="mt-4 font-display text-5xl font-semibold text-ink outline-none sm:text-6xl">
            Conte-nos quem é. Nós mostramos onde há <em>lugar</em>.
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft">
            Seis perguntas — as que um bom assistente social faria. Comparamos as respostas com as{' '}
            <strong className="text-ink">{res.length} instituições residenciais</strong> do EncontraLar e com as vagas que elas
            próprias atualizam: neste momento, <strong className="text-leaf-700">{comVaga} têm lugar livre</strong>.
          </p>

          {emCurso ? (
            <div className="mt-9 flex max-w-2xl flex-col gap-4 rounded-3xl border-2 border-pine-200 bg-pine-50 p-5 sm:p-6">
              <p className="text-base text-pine-900">
                <strong>Tem respostas a meio.</strong> Ia no passo {sessao.passo + 1} de {PASSOS.length} —{' '}
                {PASSOS[sessao.passo]!.nome.toLowerCase()}.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => acoes.irPara(sessao.passo)} iconRight={<ArrowRight aria-hidden className="size-5" />}>
                  Continuar onde ficou
                </Button>
                <Button variant="ghost" size="lg" onClick={acoes.recomecar} icon={<RotateCcw aria-hidden className="size-5" />}>
                  Recomeçar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button size="lg" onClick={() => acoes.irPara(0)} iconRight={<ArrowRight aria-hidden className="size-5" />} className="px-9">
                Começar
              </Button>
              <p className="text-base text-ink-soft">Cerca de 3 minutos · sem criar conta</p>
            </div>
          )}

          {perfis.length > 0 && (
            <div className="mt-10 max-w-2xl">
              <h2 className="text-lg font-bold text-ink">Ou use um perfil que já guardou</h2>
              <ul className="mt-3 flex flex-col gap-3">
                {perfis.map((pf) => (
                  <li key={pf.id}>
                    <button
                      type="button"
                      onClick={() => acoes.usarPerfil(pf)}
                      className="group flex w-full items-center gap-4 rounded-3xl border-2 border-line bg-white p-4 text-left shadow-soft transition-colors hover:border-pine-500"
                    >
                      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-terra-100 text-terra-800">
                        <UserRound className="size-6" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-base font-bold text-ink">Usar o perfil de {pf.nome}</span>
                        <span className="block text-sm text-ink-soft">
                          {pf.relacao} · {pf.idade} anos · {GRAU_LABEL[pf.grau]} · {pf.local.label}
                        </span>
                      </span>
                      <ArrowRight aria-hidden className="size-5 text-pine-700 transition-transform group-hover:translate-x-1" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-10 flex max-w-2xl items-start gap-3 border-l-4 border-terra-400 pl-4 text-base text-ink-soft">
            <Hospital aria-hidden className="mt-0.5 size-5 shrink-0 text-terra-600" />
            <span>
              <strong className="text-ink">Alta hospitalar marcada?</strong> Diga-o no último passo: damos prioridade aos lares com
              vaga já, e explicamos como pedir apoio enquanto espera.
            </span>
          </p>
        </div>

        <aside aria-labelledby="perguntas-t" className="lg:col-span-5">
          <div className="overflow-hidden rounded-4xl border border-line bg-sand shadow-card">
            <AzulejoBand className="h-12" color="#1d564e" opacity={0.3} size={48} />
            <div className="px-6 pt-6 pb-4 sm:px-8">
              <h2 id="perguntas-t" className="font-display text-2xl font-semibold text-ink">
                O que vamos <em>perguntar</em>, e porquê
              </h2>
            </div>
            <ol className="px-6 pb-7 sm:px-8">
              {PASSOS.map((s, i) => (
                <li key={s.id} className={cn('flex gap-5 py-3.5', i > 0 && 'border-t border-dashed border-line-strong')}>
                  <span aria-hidden className="w-10 shrink-0 font-display text-3xl leading-none font-semibold text-terra-600 tabular">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-base font-bold text-ink">{s.nome}</span>
                    <span className="block text-sm text-ink-soft">{PORQUE[s.id]}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line bg-cream/70 px-6 py-4 text-sm text-ink-soft sm:px-8">
              As respostas ficam só neste separador até decidir guardá-las. São dados de saúde — tratamo-los com esse cuidado.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
