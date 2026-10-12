import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useDocumentTitle } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { usePedidos, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { PedidoCard } from './PedidoCard'

type Aba = 'ativos' | 'terminados'
const ABAS: { k: Aba; label: string }[] = [
  { k: 'ativos', label: 'Ativos' },
  { k: 'terminados', label: 'Terminados' },
]

export default function PedidosPage() {
  useDocumentTitle('Os meus pedidos')
  const { ativos, terminados } = usePedidos()
  const { principal } = usePerfisOrdenados()
  const { hash } = useLocation()
  const alvo = hash.startsWith('#pedido-') ? hash.slice(8) : null
  const [aba, setAba] = useState<Aba>(() => (alvo && terminados.some((p) => p.c.id === alvo) ? 'terminados' : 'ativos'))
  const tabs = useRef<Record<Aba, HTMLButtonElement | null>>({ ativos: null, terminados: null })

  // ir ao pedido indicado no endereço (ex.: vindo de uma notificação), depois do scroll-to-top do Layout
  useEffect(() => {
    if (!alvo) return
    const t = window.setTimeout(() => document.getElementById(`pedido-${alvo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => window.clearTimeout(t)
  }, [alvo])

  const lista = aba === 'ativos' ? ativos : terminados
  const contagem: Record<Aba, number> = { ativos: ativos.length, terminados: terminados.length }
  const pesquisa = principal ? pesquisaUrl(principal, { vaga: 'breve' }) : '/pesquisa?vaga=breve'

  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next: Aba = e.key === 'Home' ? 'ativos' : e.key === 'End' ? 'terminados' : aba === 'ativos' ? 'terminados' : 'ativos'
    setAba(next)
    tabs.current[next]?.focus()
  }

  if (ativos.length + terminados.length === 0) {
    return (
      <EmptyState
        title="Ainda não pediu vaga"
        text="Na ficha de cada instituição há um botão “Pedir vaga”. Pode pedir em várias ao mesmo tempo e acompanhar tudo aqui."
        action={<ButtonLink to={pesquisa}>Encontrar instituições com vaga</ButtonLink>}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Pedidos" className="inline-flex rounded-full bg-sand p-1" onKeyDown={onKey}>
          {ABAS.map(({ k, label }) => (
            <button
              key={k}
              ref={(el) => {
                tabs.current[k] = el
              }}
              type="button"
              role="tab"
              id={`aba-${k}`}
              aria-selected={aba === k}
              aria-controls="pedidos-painel"
              tabIndex={aba === k ? 0 : -1}
              onClick={() => setAba(k)}
              className={cn(
                'inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-medium transition-[background-color,color,box-shadow] duration-200',
                aba === k ? 'bg-white text-ink shadow-soft' : 'text-ink-mute hover:text-ink',
              )}
            >
              {label}
              <span className="text-ink-mute tabular">{contagem[k]}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-mute" aria-live="polite">
          {aba === 'ativos'
            ? `${ativos.length === 1 ? '1 pedido em curso' : `${ativos.length} pedidos em curso`}. Cada mudança chega por notificação.`
            : `${terminados.length === 1 ? '1 pedido terminado' : `${terminados.length} pedidos terminados`}.`}
        </p>
      </div>

      <div id="pedidos-painel" role="tabpanel" aria-labelledby={`aba-${aba}`} className="mt-8 flex flex-col gap-8">
        {lista.length === 0 ? (
          aba === 'ativos' ? (
            <EmptyState
              title="Sem pedidos em curso"
              text="Os pedidos anteriores estão em “Terminados”."
              action={<ButtonLink to={pesquisa}>Encontrar instituições com vaga</ButtonLink>}
            />
          ) : (
            <EmptyState title="Nenhum pedido terminado" text="Os pedidos cancelados ou sem vaga ficam aqui, para referência." />
          )
        ) : (
          lista.map(({ c, lar }) => <PedidoCard key={c.id} c={c} lar={lar} />)
        )}
      </div>
    </div>
  )
}
