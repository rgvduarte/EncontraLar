import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { getDB, registarVagaLibertada } from '@/lib/store'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { destinatariosAviso, nomeQuarto } from '../lib/derive'
import { animar, useTroca, VistoAnimado } from '../shared/motion'
import { MoreLink, capitalizar } from '../shared/ui'

interface Resultado {
  tipo: TipoQuarto
  avisadas: number
  lista: number
}

/** Conta de 0 até `alvo`, depois de `atraso` ms (respeita prefers-reduced-motion). */
function useContagem(alvo: number, ms = 900, atraso = 0): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (alvo <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(alvo)
      return
    }
    let raf = 0
    const inicio = setTimeout(() => {
      const t0 = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / ms)
        setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, atraso)
    return () => {
      clearTimeout(inicio)
      cancelAnimationFrame(raf)
    }
  }, [alvo, ms, atraso])
  return v
}

const MAX_PONTOS = 12

/** Uma bolinha por família avisada, que se acende em sequência — o aviso a "sair" para cada uma. */
function Pontos({ n, atraso }: { n: number; atraso: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const vis = Math.min(n, MAX_PONTOS)
  useLayoutEffect(() => {
    const filhos = ref.current?.children
    if (!filhos) return
    Array.from(filhos).forEach((el, i) =>
      animar(
        el,
        [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1.35)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 420, delay: atraso + (i * 700) / Math.max(vis, 1), fill: 'backwards' },
      ),
    )
  }, [vis, atraso])
  return (
    <span ref={ref} aria-hidden className="mt-5 flex flex-wrap items-center gap-1.5">
      {Array.from({ length: vis }, (_, i) => (
        <span key={i} className="size-3 rounded-full bg-leaf-500" />
      ))}
      {n > MAX_PONTOS && <span className="ml-1 text-sm font-medium text-leaf-700 tabular">+{n - MAX_PONTOS}</span>}
    </span>
  )
}

/** Confirmação: o visto desenha-se, o número de famílias avisadas conta e as bolinhas acendem-se. */
function Sucesso({ r, onOutra }: { r: Resultado; onOutra: () => void }) {
  const ATRASO = 380
  const n = useContagem(r.avisadas, 900, ATRASO)
  return (
    <div role="status">
      <h2 id="saida-titulo" className="sr-only">
        Saiu um residente?
      </h2>
      <VistoAnimado className="size-14" />
      {r.avisadas > 0 ? (
        <>
          <p className="mt-5 text-7xl leading-none font-semibold tracking-tight tabular" aria-hidden>
            {n}
          </p>
          <p className="mt-2 text-xl font-semibold">
            <span className="sr-only">{r.avisadas} </span>
            {r.avisadas === 1 ? 'família foi avisada.' : 'famílias foram avisadas.'}
          </p>
          <Pontos n={r.avisadas} atraso={ATRASO} />
        </>
      ) : (
        <p className="mt-5 text-2xl font-semibold sm:text-3xl">Vaga registada.</p>
      )}
      <p className="mt-3 text-ink-mute">
        {r.avisadas > 0 ? '' : 'Ninguém está à espera deste quarto neste momento. '}O {nomeQuarto(r.tipo)} já aparece como livre no mapa de vagas.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 max-sm:flex-col max-sm:items-stretch">
        {r.lista > 0 && (
          <ButtonLink to="/gestao/pedidos?filtro=lista" className="max-sm:w-full">
            Propor à lista de espera
          </ButtonLink>
        )}
        <button type="button" onClick={onOutra} className="link min-h-12 max-sm:text-center">
          Registar outra saída
        </button>
      </div>
    </div>
  )
}

/** "Saiu um residente? Registe a vaga" — o atalho mais importante para quem gere a casa. */
export function VagaLibertadaPanel({ lar }: { lar: Lar }) {
  const nome = useId()
  const inicial = () => {
    const disponiveis = lar.quartos.filter((q) => q.livres < q.total)
    return disponiveis.length === 1 ? disponiveis[0]!.tipo : null
  }
  const [tipo, setTipo] = useState<TipoQuarto | null>(inicial)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  // a troca formulário ↔ confirmação faz-se com um cross-fade suave
  const conteudo = useTroca<HTMLDivElement>(resultado ? 'ok' : 'form', [
    { opacity: 0, transform: 'scale(0.97)', filter: 'blur(6px)' },
    { opacity: 1, transform: 'none', filter: 'blur(0)' },
  ])

  const registar = () => {
    if (!tipo) return
    const d = destinatariosAviso(getDB(), lar)
    const avisadas = registarVagaLibertada(lar.id, tipo)
    setResultado({ tipo, avisadas, lista: d.lista })
    toast.success(
      avisadas === 0 ? 'Vaga registada' : avisadas === 1 ? '1 família foi avisada' : `${avisadas} famílias foram avisadas`,
      `${capitalizar(nomeQuarto(tipo))}: mais um lugar livre no mapa de vagas.`,
    )
  }

  return (
    <section aria-labelledby="saida-titulo" className="tile max-sm:p-6">
      <div ref={conteudo}>
        {resultado ? (
          <Sucesso
            r={resultado}
            onOutra={() => {
              setResultado(null)
              setTipo(inicial())
            }}
          />
        ) : (
          <>
            <h2 id="saida-titulo" className="text-2xl font-semibold sm:text-3xl">
              Saiu um residente?
            </h2>
            <p className="mt-1.5 text-ink-mute">Registe a vaga. Avisamos logo as famílias que esperam.</p>

            {lar.quartos.length === 0 ? (
              <p className="mt-6 text-ink-mute">
                Indique primeiro os tipos de quarto. <MoreLink to="/gestao/vagas">Ir para Vagas</MoreLink>
              </p>
            ) : (
              <>
                <fieldset className="mt-6">
                  <legend className="mb-3 text-sm text-ink-mute">Que quarto ficou livre?</legend>
                  <div className="flex flex-col gap-2">
                    {lar.quartos.map((q) => {
                      const cheio = q.livres >= q.total
                      return (
                        <label
                          key={q.tipo}
                          className={cn(
                            'group flex min-h-14 items-center gap-3 rounded-2xl bg-white px-5 ring-1 ring-transparent transition-shadow duration-200',
                            'has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                            cheio ? 'cursor-not-allowed text-ink-mute' : 'cursor-pointer hover:ring-line-strong',
                          )}
                        >
                          <input
                            type="radio"
                            name={nome}
                            value={q.tipo}
                            checked={tipo === q.tipo}
                            disabled={cheio}
                            onChange={() => setTipo(q.tipo)}
                            className="sr-only"
                          />
                          <span className="flex-1 font-medium">{QUARTO_CURTO[q.tipo]}</span>
                          <span className="text-sm text-ink-mute tabular">{cheio ? 'todos livres' : `${q.livres} de ${q.total} livres`}</span>
                          <Check aria-hidden strokeWidth={2.5} className="hidden size-5 shrink-0 text-ink group-has-[:checked]:block" />
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                <Button size="lg" full className="mt-5" disabled={!tipo} onClick={registar}>
                  {tipo ? `Registar vaga — ${QUARTO_CURTO[tipo].toLowerCase()}` : 'Escolha o quarto'}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}
