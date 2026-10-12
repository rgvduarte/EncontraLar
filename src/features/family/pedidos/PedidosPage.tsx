import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router'
import { Archive, FileText, Map } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useDocumentTitle } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { usePedidos, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { PedidoCard } from './PedidoCard'

type Aba = 'ativos' | 'terminados'

export default function PedidosPage() {
  useDocumentTitle('Os meus pedidos')
  const { ativos, terminados } = usePedidos()
  const { principal } = usePerfisOrdenados()
  const { hash } = useLocation()
  const alvo = hash.startsWith('#pedido-') ? hash.slice(8) : null
  const [aba, setAba] = useState<Aba>(() => (alvo && terminados.some((p) => p.c.id === alvo) ? 'terminados' : 'ativos'))
  const tabs = useRef<Record<Aba, HTMLButtonElement | null>>({ ativos: null, terminados: null })

  // ir ao pedido indicado no endereço (ex.: vindo de uma notificação) — depois do scroll-to-top do Layout
  useEffect(() => {
    if (!alvo) return
    const t = window.setTimeout(() => document.getElementById(`pedido-${alvo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => window.clearTimeout(t)
  }, [alvo])

  const lista = aba === 'ativos' ? ativos : terminados
  const contagem = { ativos: ativos.length, terminados: terminados.length }
  const pesquisa = principal ? pesquisaUrl(principal) : '/pesquisa'
  const pesquisaVaga = principal ? pesquisaUrl(principal, { vaga: 'breve' }) : '/pesquisa?vaga=breve'

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next: Aba = e.key === 'Home' ? 'ativos' : e.key === 'End' ? 'terminados' : aba === 'ativos' ? 'terminados' : 'ativos'
    setAba(next)
    tabs.current[next]?.focus()
  }

  if (ativos.length + terminados.length === 0) {
    return (
      <EmptyState
        icon={<FileText />}
        title="Ainda não pediu vaga em nenhuma instituição"
        text="Na ficha de cada lar há um botão “Pedir vaga”. Pode pedir em várias ao mesmo tempo — aqui acompanha as respostas, o lugar na lista de espera e as visitas."
        action={
          <ButtonLink to={pesquisa} icon={<Map aria-hidden className="size-5" />}>
            Procurar no mapa de vagas
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Filtrar pedidos" className="inline-flex rounded-2xl border border-line bg-white p-1 shadow-soft" onKeyDown={onKey}>
          {(['ativos', 'terminados'] as Aba[]).map((a) => (
            <button
              key={a}
              ref={(el) => {
                tabs.current[a] = el
              }}
              type="button"
              role="tab"
              id={`aba-${a}`}
              aria-selected={aba === a}
              aria-controls="pedidos-painel"
              tabIndex={aba === a ? 0 : -1}
              onClick={() => setAba(a)}
              className={cn(
                'inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-bold transition-colors',
                aba === a ? 'bg-pine-800 text-white' : 'text-ink-soft hover:bg-sand hover:text-ink',
              )}
            >
              {a === 'ativos' ? 'Ativos' : 'Terminados'}
              <span className={cn('rounded-full px-2 text-sm tabular', aba === a ? 'bg-white/20' : 'bg-sand')}>{contagem[a]}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-soft" aria-live="polite">
          {aba === 'ativos'
            ? `${ativos.length === 1 ? '1 pedido em curso' : `${ativos.length} pedidos em curso`}. Cada mudança chega-lhe por notificação.`
            : `${terminados.length === 1 ? '1 pedido terminado' : `${terminados.length} pedidos terminados`} (cancelados ou sem vaga).`}
        </p>
      </div>

      <div id="pedidos-painel" role="tabpanel" aria-labelledby={`aba-${aba}`} className="mt-6 flex flex-col gap-8">
        {lista.length === 0 ? (
          aba === 'ativos' ? (
            <EmptyState
              icon={<FileText />}
              title="Sem pedidos em curso"
              text="Os pedidos anteriores estão em “Terminados”. Se ainda procura lar, veja as instituições com vaga ou prevista em breve."
              action={
                <ButtonLink to={pesquisaVaga} icon={<Map aria-hidden className="size-5" />}>
                  Ver instituições com vaga
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState icon={<Archive />} title="Nenhum pedido terminado" text="Os pedidos que cancelar ou que não tenham vaga ficam aqui, para referência." />
          )
        ) : (
          lista.map(({ c, lar }) => <PedidoCard key={c.id} c={c} lar={lar} />)
        )}
      </div>
    </div>
  )
}
