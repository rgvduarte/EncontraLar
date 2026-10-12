import { useSearchParams } from 'react-router'
import type { Candidatura, Lar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { FILTROS, filtroDoEstado, type FiltroPedidos } from '../lib/derive'
import { useAgora } from '../lib/hooks'
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

/** /gestao/pedidos — pedidos por estado (controlo segmentado), ações num toque e a lista de espera completa. */
export default function PedidosPage({ lar, cands }: { lar: Lar; cands: Candidatura[] }) {
  const [params, setParams] = useSearchParams()
  const agora = useAgora()
  const contagem = Object.fromEntries(FILTROS.map((f) => [f.id, cands.filter((c) => f.estados.includes(c.estado)).length])) as Record<FiltroPedidos, number>

  const pedidoId = params.get('pedido')
  const aberto = pedidoId ? cands.find((c) => c.id === pedidoId) : undefined
  const fp = params.get('filtro')
  const filtro: FiltroPedidos = ehFiltro(fp) ? fp : aberto ? filtroDoEstado(aberto.estado) : (ORDEM_DEFAULT.find((f) => contagem[f] > 0) ?? 'novos')
  const def = FILTROS.find((f) => f.id === filtro)!

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
        <div className="mt-3 flex flex-wrap gap-3">
          <ButtonLink to="/gestao/ficha">Completar a ficha</ButtonLink>
          <ButtonLink to="/gestao/vagas" variant="secondary">
            Confirmar vagas
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Mostrar pedidos por estado" className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="inline-flex gap-1 rounded-full bg-sand p-1">
          {FILTROS.map((f) => {
            const ativo = f.id === filtro
            const n = contagem[f.id]
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => mudarFiltro(f.id)}
                className={cn(
                  'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[0.9375rem] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200',
                  ativo ? 'bg-white font-semibold text-ink shadow-soft' : 'text-ink-mute hover:text-ink',
                )}
              >
                {f.label}
                <span className={cn('tabular', f.id === 'novos' && n > 0 ? 'font-semibold text-terra-600' : 'text-ink-mute')}>{n}</span>
              </button>
            )
          })}
        </div>
      </div>

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
        lista.length > 0 && (
          <ul className="divide-y divide-line">
            {lista.map((c) => (
              <PedidoRow key={c.id} c={c} lar={lar} agora={agora} verHref={verHref(c)} />
            ))}
          </ul>
        )
      )}

      {aberto && <PedidoDetailModal key={aberto.id} c={aberto} lar={lar} agora={agora} onClose={fecharDetalhe} />}
    </div>
  )
}
