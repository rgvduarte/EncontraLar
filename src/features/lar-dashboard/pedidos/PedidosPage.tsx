import { useSearchParams } from 'react-router'
import { FileText, Inbox, RefreshCw } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { FILTROS, filtroDoEstado, type FiltroPedidos } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { ListaEsperaLedger } from './ListaEsperaLedger'
import { PedidoCard } from './PedidoCard'
import { PedidoDetailModal } from './PedidoDetailModal'

const ORDEM_DEFAULT: FiltroPedidos[] = ['novos', 'analise', 'proposta', 'lista', 'concluidos']
const ehFiltro = (s: string | null): s is FiltroPedidos => FILTROS.some((f) => f.id === s)

const RESUMO_FILTRO: Record<FiltroPedidos, (n: number) => string> = {
  novos: (n) => (n === 1 ? '1 pedido novo — os urgentes aparecem primeiro.' : `${n} pedidos novos — os urgentes aparecem primeiro.`),
  analise: (n) => (n === 1 ? '1 pedido em análise.' : `${n} pedidos em análise.`),
  lista: (n) => (n === 1 ? '1 pedido na lista de espera.' : `${n} pedidos na lista de espera.`),
  proposta: (n) => (n === 1 ? '1 vaga proposta à espera de resposta.' : `${n} vagas propostas à espera de resposta.`),
  concluidos: (n) => (n === 1 ? '1 pedido concluído.' : `${n} pedidos concluídos.`),
}

/** /gestao/pedidos — pedidos por estado, com ações num toque e a lista de espera completa. */
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
      <EmptyState
        icon={<Inbox />}
        title="Ainda não recebeu pedidos pela plataforma"
        text="Os pedidos chegam quando as famílias encontram a sua ficha. Fichas completas e com vagas confirmadas recentemente aparecem primeiro nas pesquisas — e recebem mais pedidos."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to="/gestao/ficha" icon={<FileText aria-hidden className="size-5" />}>
              Completar a ficha
            </ButtonLink>
            <ButtonLink to="/gestao/vagas" variant="secondary" icon={<RefreshCw aria-hidden className="size-5" />}>
              Confirmar vagas
            </ButtonLink>
          </div>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Mostrar pedidos por estado" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-soft sm:min-w-0">
          {FILTROS.map((f) => {
            const ativo = f.id === filtro
            const n = contagem[f.id]
            const destaque = f.id === 'novos' && n > 0
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => mudarFiltro(f.id)}
                className={cn(
                  'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 font-bold whitespace-nowrap transition-colors',
                  ativo ? 'bg-pine-800 text-white shadow-soft' : 'text-ink-soft hover:bg-sand hover:text-ink',
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'flex min-w-6 items-center justify-center rounded-full px-1.5 text-sm tabular',
                    ativo ? 'bg-white/20 text-white' : destaque ? 'bg-terra-600 text-white' : 'bg-sand text-ink-soft',
                  )}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p role="status" aria-live="polite" className="-mt-2 text-ink-soft">
        {lista.length ? RESUMO_FILTRO[filtro](lista.length) : `Nada em «${def.label}».`}
      </p>

      {filtro === 'lista' ? (
        <ListaEsperaLedger lar={lar} cands={cands} agora={agora} verHref={verHref} />
      ) : lista.length === 0 ? (
        <EmptyState icon={<Inbox />} title={`Nada em «${def.label}»`} text={def.vazio} className="py-10" />
      ) : (
        <div className="flex flex-col gap-5">
          {lista.map((c) => (
            <PedidoCard key={c.id} c={c} lar={lar} agora={agora} verHref={verHref(c)} />
          ))}
        </div>
      )}

      {aberto && <PedidoDetailModal key={aberto.id} c={aberto} lar={lar} agora={agora} onClose={fecharDetalhe} />}
    </div>
  )
}
