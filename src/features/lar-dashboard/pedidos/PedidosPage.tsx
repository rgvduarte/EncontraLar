import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { FILTROS, filtroDoEstado, type FiltroPedidos } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { useFlip, usePresenca, useTroca } from '../shared/motion'
import { Segmented } from '../shared/Segmented'
import { ListaEspera } from './ListaEspera'
import { PedidoDetailModal } from './PedidoDetailModal'
import { PedidoRow } from './PedidoRow'

const ORDEM_DEFAULT: FiltroPedidos[] = ['novos', 'analise', 'proposta', 'lista', 'concluidos']
const ehFiltro = (s: string | null): s is FiltroPedidos => FILTROS.some((f) => f.id === s)

const RESUMO_FILTRO: Record<FiltroPedidos, (n: number) => string> = {
  novos: (n) => (n === 1 ? '1 pedido novo.' : `${n} pedidos novos. Os urgentes aparecem primeiro.`),
  analise: (n) => (n === 1 ? '1 pedido em análise.' : `${n} pedidos em análise.`),
  lista: () => '',
  proposta: (n) => (n === 1 ? '1 vaga proposta à espera de resposta.' : `${n} vagas propostas à espera de resposta.`),
  concluidos: (n) => (n === 1 ? '1 pedido concluído.' : `${n} pedidos concluídos.`),
}

/** Os pedidos de um separador. Remonta ao mudar de separador; dentro dele, as linhas que mudam de estado saem a desvanecer. */
function ListaPedidos({ lista, lar, agora, verHref }: { lista: Candidatura[]; lar: Lar; agora: number; verHref: (c: Candidatura) => string }) {
  const ref = useRef<HTMLUListElement>(null)
  const presentes = usePresenca(lista, (c) => c.id)
  useFlip(ref, presentes)
  if (!presentes.length) return null
  return (
    <ul ref={ref} className="relative divide-y divide-line [overflow-anchor:none]">
      {presentes.map(({ key, item, leaving }) => (
        <PedidoRow key={key} c={item} lar={lar} agora={agora} verHref={verHref(item)} leaving={leaving} />
      ))}
    </ul>
  )
}

/**
 * /gestao/pedidos — pedidos por estado (controlo segmentado com indicador deslizante), ações num toque
 * e a lista de espera completa. Ao mudar de separador, o conteúdo desliza do lado do separador escolhido.
 */
export default function PedidosPage({ lar, cands }: { lar: Lar; cands: Candidatura[] }) {
  const [params, setParams] = useSearchParams()
  const agora = useAgora()
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.id, cands.filter((c) => f.estados.includes(c.estado)).length])) as Record<FiltroPedidos, number>

  const pedidoId = params.get('pedido')
  const aberto = pedidoId ? cands.find((c) => c.id === pedidoId) : undefined
  // o último pedido aberto fica montado enquanto a folha desce (animação de fecho)
  const ultimoAberto = useRef<Candidatura | undefined>(undefined)
  if (aberto) ultimoAberto.current = aberto
  const detalhe = aberto ?? ultimoAberto.current
  const fp = params.get('filtro')
  const filtro: FiltroPedidos = ehFiltro(fp) ? fp : aberto ? filtroDoEstado(aberto.estado) : (ORDEM_DEFAULT.find((f) => contagem[f] > 0) ?? 'novos')
  const def = FILTROS.find((f) => f.id === filtro)!

  // direção da transição: para a direita quando se escolhe um separador mais à frente
  const indice = FILTROS.findIndex((f) => f.id === filtro)
  const anterior = useRef(indice)
  const dir = indice >= anterior.current ? 1 : -1
  useEffect(() => {
    anterior.current = indice
  }, [indice])
  const palco = useTroca<HTMLDivElement>(
    filtro,
    [
      { opacity: 0, transform: `translateX(${dir * 28}px)` },
      { opacity: 1, transform: 'none' },
    ],
    480,
  )

  const lista = cands
    .filter((c) => def.estados.includes(c.estado))
    .sort((a, b) =>
      filtro === 'novos'
        ? Number(b.perfil.urgencia === 'imediata') - Number(a.perfil.urgencia === 'imediata') || b.criadaEm.localeCompare(a.criadaEm)
        : b.atualizadaEm.localeCompare(a.atualizadaEm),
    )

  const mudarFiltro = (f: FiltroPedidos) => {
    const next = new URLSearchParams(params)
    next.set('filtro', f)
    next.delete('pedido')
    setParams(next, { replace: true })
  }
  const verHref = (c: Candidatura) => `/gestao/pedidos?filtro=${filtro}&pedido=${encodeURIComponent(c.id)}`
  const fecharDetalhe = () => {
    const next = new URLSearchParams(params)
    next.delete('pedido')
    setParams(next)
  }

  if (cands.length === 0) {
    return (
      <div className="tile flex flex-col items-start gap-3">
        <h2 className="text-2xl font-semibold">Ainda não recebeu pedidos</h2>
        <p className="max-w-xl text-ink-mute">
          Chegam quando as famílias encontram a sua ficha. Fichas completas e com vagas confirmadas há pouco aparecem primeiro nas pesquisas.
        </p>
        <div className="mt-3 flex w-full flex-wrap gap-3 max-sm:flex-col">
          <ButtonLink to="/gestao/ficha" className="max-sm:w-full">
            Completar a ficha
          </ButtonLink>
          <ButtonLink to="/gestao/vagas" variant="secondary" className="max-sm:w-full">
            Confirmar vagas
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Mostrar pedidos por estado"
        valor={filtro}
        onChange={mudarFiltro}
        itens={FILTROS.map((f) => ({ id: f.id, label: f.label, n: contagem[f.id], destaque: f.id === 'novos' }))}
      />

      <div ref={palco} className="flex flex-col gap-4">
        {filtro !== 'lista' && (
          <p role="status" aria-live="polite" className="mt-2 text-ink-mute">
            {lista.length ? RESUMO_FILTRO[filtro](lista.length) : def.vazio}
          </p>
        )}

        {filtro === 'lista' ? (
          <div className="mt-2">
            <ListaEspera lar={lar} cands={cands} agora={agora} verHref={verHref} />
          </div>
        ) : (
          <ListaPedidos key={filtro} lista={lista} lar={lar} agora={agora} verHref={verHref} />
        )}
      </div>

      {detalhe && <PedidoDetailModal key={detalhe.id} open={Boolean(aberto)} c={detalhe} lar={lar} agora={agora} onClose={fecharDetalhe} />}
    </div>
  )
}
