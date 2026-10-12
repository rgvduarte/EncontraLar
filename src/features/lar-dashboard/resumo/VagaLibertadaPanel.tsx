import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BellRing, DoorOpen, RotateCcw } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { AzulejoBand } from '@/components/brand/patterns'
import { getDB, registarVagaLibertada } from '@/lib/store'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { destinatariosAviso } from '../lib/derive'

interface Resultado {
  tipo: TipoQuarto
  avisadas: number
  lista: number
  seguidores: number
}

/** Conta de 0 até `alvo` (respeita prefers-reduced-motion). */
function useContagem(alvo: number, ms = 900): number {
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
  const partes = [
    r.lista ? `${r.lista} na sua lista de espera` : null,
    r.seguidores ? `${r.seguidores} ${r.seguidores === 1 ? 'que segue' : 'que seguem'} a sua ficha` : null,
  ].filter(Boolean)
  return (
    <div className="animate-fade-up" role="status">
      <div className="flex items-center gap-4">
        <span className="relative flex size-20 shrink-0 items-center justify-center rounded-full bg-terra-600 text-white shadow-soft">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-terra-400/40 [animation-iteration-count:2] motion-reduce:hidden" />
          <BellRing aria-hidden className="relative size-9" />
        </span>
        <p className="leading-tight">
          <span className="block font-display text-6xl font-semibold text-terra-700 tabular">{n}</span>
          <span className="block text-lg font-bold">{r.avisadas === 1 ? 'família foi avisada' : 'famílias foram avisadas'}</span>
        </p>
      </div>
      <p className="mt-4 text-ink-soft">
        {r.avisadas > 0 ? (
          <>
            {partes.join(' e ')}. O {QUARTO_LABEL[r.tipo].toLowerCase()} já aparece como livre no mapa de vagas.
          </>
        ) : (
          <>Ninguém estava à espera de aviso, mas o {QUARTO_LABEL[r.tipo].toLowerCase()} já aparece como livre no mapa de vagas.</>
        )}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {r.lista > 0 && (
          <Link to="/gestao/pedidos?filtro=lista" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-pine-700 px-5 font-bold text-white shadow-soft hover:bg-pine-800">
            Propor à lista de espera <ArrowRight aria-hidden className="size-5" />
          </Link>
        )}
        <Button variant="ghost" icon={<RotateCcw aria-hidden className="size-5" />} onClick={onOutra}>
          Registar outra saída
        </Button>
      </div>
    </div>
  )
}

/** "Saiu um residente? Registe a vaga" — o atalho mais importante para quem gere a casa. */
export function VagaLibertadaPanel({ lar }: { lar: Lar }) {
  const nome = useId()
  const [tipo, setTipo] = useState<TipoQuarto | null>(lar.quartos.length === 1 ? lar.quartos[0]!.tipo : null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const registar = () => {
    if (!tipo) return
    const d = destinatariosAviso(getDB(), lar)
    const avisadas = registarVagaLibertada(lar.id, tipo)
    setResultado({ tipo, avisadas, lista: d.lista, seguidores: d.seguidores })
    toast.success(
      avisadas === 0 ? 'Vaga registada' : avisadas === 1 ? '1 família foi avisada' : `${avisadas} famílias foram avisadas`,
      `${QUARTO_LABEL[tipo]}: mais um lugar livre no mapa de vagas.`,
    )
  }

  return (
    <section aria-labelledby="saida-titulo" className="relative overflow-hidden rounded-3xl border border-terra-200 bg-terra-50 shadow-card">
      <AzulejoBand color="#b9472f" opacity={0.55} size={28} className="h-7 border-b border-terra-200 bg-terra-100/60" />
      <div className="p-6 sm:p-7">
        {resultado ? (
          <Sucesso
            r={resultado}
            onOutra={() => {
              setResultado(null)
              setTipo(lar.quartos.length === 1 ? lar.quartos[0]!.tipo : null)
            }}
          />
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-terra-800 uppercase">
              <DoorOpen aria-hidden className="size-4" /> Atalho
            </p>
            <h2 id="saida-titulo" className="mt-1.5 font-display text-2xl font-semibold sm:text-3xl">
              Saiu um residente? <em>Registe a vaga.</em>
            </h2>
            <p className="mt-2 text-ink-soft">A vaga fica visível de imediato e as famílias que esperam por ela recebem o aviso. Também melhora a sua previsão.</p>

            <fieldset className="mt-5">
              <legend className="mb-2.5 font-bold">Que quarto ficou livre?</legend>
              <div className="flex flex-col gap-2">
                {lar.quartos.map((q) => {
                  const cheio = q.livres >= q.total
                  return (
                    <label
                      key={q.tipo}
                      className={cn(
                        'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 py-2 transition-colors',
                        'has-[:checked]:border-terra-600 has-[:checked]:bg-white has-[:checked]:shadow-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                        cheio ? 'cursor-not-allowed border-line opacity-60' : 'border-terra-200 hover:border-terra-400',
                      )}
                    >
                      <input
                        type="radio"
                        name={nome}
                        value={q.tipo}
                        checked={tipo === q.tipo}
                        disabled={cheio}
                        onChange={() => setTipo(q.tipo)}
                        className="size-5 shrink-0 accent-terra-600"
                      />
                      <span className="flex-1 font-bold">{QUARTO_CURTO[q.tipo]}</span>
                      <span className="text-sm text-ink-soft tabular">{cheio ? 'todos livres' : `${q.livres} de ${q.total} livres`}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Button
              variant="accent"
              size="lg"
              full
              className="mt-5 whitespace-normal disabled:bg-terra-100 disabled:text-terra-800 disabled:shadow-none"
              disabled={!tipo} onClick={registar} icon={<DoorOpen aria-hidden className="size-6" />}>
              {tipo ? `Registar vaga — quarto ${QUARTO_CURTO[tipo].toLowerCase()}` : 'Escolha primeiro o quarto'}
            </Button>
            <p className="mt-3 text-sm text-ink-soft">
              Enganou-se? Corrija em{' '}
              <Link to="/gestao/vagas" className="link">
                Vagas
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </section>
  )
}
