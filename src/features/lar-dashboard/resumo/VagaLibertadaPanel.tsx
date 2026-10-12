import { useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { getDB, registarVagaLibertada } from '@/lib/store'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { destinatariosAviso } from '../lib/derive'
import { MoreLink } from '../shared/ui'

interface Resultado {
  tipo: TipoQuarto
  avisadas: number
  lista: number
}

/** Conta de 0 até `alvo` (respeita prefers-reduced-motion). */
function useContagem(alvo: number, ms = 800): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (alvo <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(alvo)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [alvo, ms])
  return v
}

function Sucesso({ r, onOutra }: { r: Resultado; onOutra: () => void }) {
  const n = useContagem(r.avisadas)
  return (
    <div role="status" className="animate-fade-in">
      <p className="text-7xl leading-none font-semibold tracking-tight">{n}</p>
      <p className="mt-2 text-xl font-semibold">{r.avisadas === 1 ? 'família foi avisada.' : 'famílias foram avisadas.'}</p>
      <p className="mt-2 text-ink-mute">O {QUARTO_LABEL[r.tipo].toLowerCase()} já aparece como livre no mapa de vagas.</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        {r.lista > 0 && <MoreLink to="/gestao/pedidos?filtro=lista">Propor à lista de espera</MoreLink>}
        <button type="button" onClick={onOutra} className="link min-h-11">
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

  const registar = () => {
    if (!tipo) return
    const d = destinatariosAviso(getDB(), lar)
    const avisadas = registarVagaLibertada(lar.id, tipo)
    setResultado({ tipo, avisadas, lista: d.lista })
    toast.success(
      avisadas === 0 ? 'Vaga registada' : avisadas === 1 ? '1 família foi avisada' : `${avisadas} famílias foram avisadas`,
      `${QUARTO_LABEL[tipo]}: mais um lugar livre no mapa de vagas.`,
    )
  }

  return (
    <section aria-labelledby="saida-titulo" className="tile">
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
    </section>
  )
}
