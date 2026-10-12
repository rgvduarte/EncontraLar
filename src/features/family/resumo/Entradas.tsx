import { useRef, useState } from 'react'
import { toast } from '@/components/ui/Toast'
import type { PedidoComLar } from '../shared/data'
import { AvaliarModal } from '../shared/Avaliacao'
import { ConfirmarEntradaModal, EntradaTile, passoEntrada } from '../shared/Entrada'
import { Enter, sairEDepois } from '../shared/motion'

const DISPENSADOS_KEY = 'encontralar:avaliar-depois'

function lerDispensados(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(DISPENSADOS_KEY) ?? '[]')
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function guardarDispensados(s: Set<string>) {
  try {
    localStorage.setItem(DISPENSADOS_KEY, JSON.stringify([...s]))
  } catch {
    /* sem armazenamento: fica só nesta visita */
  }
}

/**
 * Entradas no Resumo: "Já entrou?" nas vagas aceites, "Confirma?" quando a instituição registou a
 * entrada e, depois da confirmação, o convite para avaliar (com "Agora não", para não insistir).
 * Os diálogos vivem aqui, e não no bloco, para não serem cortados quando o bloco muda ou sai.
 */
export function Entradas({ pedidos }: { pedidos: PedidoComLar[] }) {
  const [dispensados, setDispensados] = useState(lerDispensados)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [avaliar, setAvaliar] = useState<string | null>(null)
  const blocos = useRef<Record<string, HTMLElement | null>>({})

  const lista = pedidos.filter(({ c }) => {
    const passo = passoEntrada(c)
    return passo === 'ja-entrou' || passo === 'confirmar' || (passo === 'avaliar' && !dispensados.has(c.id))
  })
  const porId = (id: string | null) => (id ? pedidos.find((p) => p.c.id === id) : undefined)
  const aAvaliar = useRef<PedidoComLar | undefined>(undefined)
  const pa = porId(avaliar)
  if (pa) aAvaliar.current = pa

  const dispensar = (id: string) =>
    sairEDepois(blocos.current[id], () => {
      const s = new Set(dispensados).add(id)
      setDispensados(s)
      guardarDispensados(s)
      toast.info('Fica para depois', 'Pode avaliar quando quiser, no cartão do pedido em “Pedidos”.')
    })

  return (
    <>
      {lista.length > 0 && (
        <div className="flex flex-col gap-6">
          {lista.map(({ c, lar }, i) => (
            <Enter key={c.id} delay={i * 90}>
              <div
                ref={(el) => {
                  blocos.current[c.id] = el
                }}
              >
                <EntradaTile
                  c={c}
                  lar={lar}
                  onConfirmar={() => setConfirmar(c.id)}
                  onAvaliar={() => setAvaliar(c.id)}
                  onDispensar={() => dispensar(c.id)}
                />
              </div>
            </Enter>
          ))}
        </div>
      )}
      <ConfirmarEntradaModal pedido={porId(confirmar)} open={Boolean(confirmar)} onClose={() => setConfirmar(null)} />
      {aAvaliar.current && (
        <AvaliarModal c={aAvaliar.current.c} lar={aAvaliar.current.lar} open={Boolean(avaliar)} onClose={() => setAvaliar(null)} />
      )}
    </>
  )
}
