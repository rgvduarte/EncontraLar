import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { ACESSO_DESDE, AvisoAcesso } from '@/components/acesso'
import { useAcesso } from '@/lib/store'
import { linkAcesso } from '@/lib/acesso'
import { useDocumentTitle } from '@/lib/hooks'
import { useLenis } from '@/components/motion'
import { cn } from '@/lib/cn'
import { usePedidos, usePerfisOrdenados, pesquisaUrl } from '../shared/data'
import { ENTRA_DIREITA, ENTRA_ESQUERDA, Tween, useChangeAnimation } from '../shared/motion'
import { PedidoCard } from './PedidoCard'

type Aba = 'ativos' | 'terminados'
const ABAS: { k: Aba; label: string }[] = [
  { k: 'ativos', label: 'Ativos' },
  { k: 'terminados', label: 'Terminados' },
]

export default function PedidosPage() {
  useDocumentTitle('Os meus pedidos')
  const { ativos, emCurso, admitidos, terminados } = usePedidos()
  const { principal } = usePerfisOrdenados()
  const { completo } = useAcesso()
  const { hash } = useLocation()
  const alvo = hash.startsWith('#pedido-') ? hash.slice(8) : null
  const [aba, setAba] = useState<Aba>(() => (alvo && terminados.some((p) => p.c.id === alvo) ? 'terminados' : 'ativos'))
  const tabs = useRef<Record<Aba, HTMLButtonElement | null>>({ ativos: null, terminados: null })
  // depois de trocar de separador, os cartões entram com o painel (sem segunda animação própria)
  const trocou = useRef(false)
  const mudar = (k: Aba) => {
    if (k !== aba) trocou.current = true
    setAba(k)
  }

  const lenis = useLenis()
  // ir ao pedido indicado no endereço (ex.: vindo de uma notificação), depois do scroll-to-top do Layout
  useEffect(() => {
    if (!alvo) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(`pedido-${alvo}`)
      if (!el) return
      if (lenis) {
        // a página acabou de crescer (secção carregada agora): o Lenis tem de medir de novo antes de deslizar.
        // O Lenis (tal como o scrollIntoView) respeita o scroll-margin-top do cartão (cabeçalho + pílulas).
        lenis.resize()
        lenis.scrollTo(el)
      }
      else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(t)
  }, [alvo, lenis])

  // trocar de separador: o painel entra pelo lado do separador escolhido
  const painel = useRef<HTMLDivElement>(null)
  useChangeAnimation(painel, aba, aba === 'terminados' ? ENTRA_DIREITA : ENTRA_ESQUERDA, { duration: 450 })

  const lista = aba === 'ativos' ? ativos : terminados
  const contagem: Record<Aba, number> = { ativos: ativos.length, terminados: terminados.length }
  const pesquisa = principal ? pesquisaUrl(principal, { vaga: 'breve' }) : '/pesquisa?vaga=breve'
  // versão grátis: pedir vaga é do Acesso Família — os estados vazios levam à página do passe
  const acaoNovoPedido = completo ? (
    <ButtonLink to={pesquisa}>Encontrar instituições com vaga</ButtonLink>
  ) : (
    <div className="flex flex-col items-center gap-2">
      <ButtonLink to={linkAcesso('/familia/pedidos')}>Ver o Acesso Família</ButtonLink>
      <span className="text-sm text-ink-mute">{ACESSO_DESDE}</span>
    </div>
  )

  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next: Aba = e.key === 'Home' ? 'ativos' : e.key === 'End' ? 'terminados' : aba === 'ativos' ? 'terminados' : 'ativos'
    mudar(next)
    tabs.current[next]?.focus()
  }

  if (ativos.length + terminados.length === 0) {
    return (
      <EmptyState
        title="Ainda não pediu vaga"
        text={
          completo
            ? 'Na ficha de cada instituição há um botão “Pedir vaga”. Pode pedir em várias ao mesmo tempo e acompanhar tudo aqui.'
            : 'Com o Acesso Família, envia o perfil de cuidados a várias casas de uma vez e acompanha aqui cada pedido. Um pedido não obriga a nada.'
        }
        action={acaoNovoPedido}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* controlo segmentado (iOS): a pastilha branca desliza para o separador ativo */}
        <div
          role="tablist"
          aria-label="Pedidos"
          className="relative grid w-full grid-cols-2 rounded-full bg-sand p-1 sm:inline-grid sm:w-auto"
          onKeyDown={onKey}
        >
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-soft transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ transform: aba === 'terminados' ? 'translateX(100%)' : 'none' }}
          />
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
              onClick={() => mudar(k)}
              className={cn(
                'relative inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-medium transition-colors duration-200',
                aba === k ? 'text-ink' : 'text-ink-mute hover:text-ink',
              )}
            >
              {label} <Tween value={contagem[k]} className="text-ink-mute" />
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-mute" aria-live="polite">
          {aba === 'ativos'
            ? [
                emCurso.length > 0 && `${emCurso.length === 1 ? '1 pedido em curso' : `${emCurso.length} pedidos em curso`}.`,
                admitidos.length > 0 && (admitidos.length === 1 ? '1 entrada registada.' : `${admitidos.length} entradas registadas.`),
                emCurso.length > 0 && 'Cada mudança chega por notificação.',
              ]
                .filter(Boolean)
                .join(' ')
            : `${terminados.length === 1 ? '1 pedido terminado' : `${terminados.length} pedidos terminados`}.`}
        </p>
      </div>

      {/* versão grátis com pedidos (o passe terminou): os pedidos continuam a ser da família; um só aviso, aqui */}
      {!completo && ativos.length > 0 && (
        <AvisoAcesso
          texto="Os pedidos continuam ativos e pode geri-los aqui. A previsão de espera, os contactos e novas visitas estão disponíveis com o Acesso Família."
          voltar="/familia/pedidos"
          className="mt-8"
        />
      )}

      <div ref={painel} id="pedidos-painel" role="tabpanel" aria-labelledby={`aba-${aba}`} className="mt-10 flex flex-col gap-12 sm:mt-8 sm:gap-8">
        {lista.length === 0 ? (
          aba === 'ativos' ? (
            <EmptyState title="Sem pedidos em curso" text="Os pedidos anteriores estão em “Terminados”." action={acaoNovoPedido} />
          ) : (
            <EmptyState title="Nenhum pedido terminado" text="Os pedidos cancelados ou sem vaga ficam aqui, para referência." />
          )
        ) : (
          lista.map(({ c, lar }, i) => (
            <PedidoCard key={c.id} c={c} lar={lar} index={i} animateIn={!trocou.current} thumbBar={aba === 'ativos' && i === lista.findIndex((p) => p.c.estado === 'vaga_proposta')} />
          ))
        )}
      </div>
    </div>
  )
}
