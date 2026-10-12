import type { ReactNode } from 'react'
import { ArrowRight, BedDouble, CalendarCheck, CircleCheck, Hourglass, Inbox, Phone, RefreshCw } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { confirmarVagasAtualizadas, confirmarVisita } from '@/lib/store'
import { tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { assuntosPendentes, diasDesde, prazo, textoVisita, textoVisitaCurto } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { PanelHeading } from '../shared/PanelHeading'
import { UrgenciaBadge, perfilLinha, relacaoTexto } from '../shared/pedidoBits'

type Tom = 'terra' | 'pine' | 'sun' | 'leaf'

interface Item {
  id: string
  tom: Tom
  icon: typeof Inbox
  rotulo: string
  quando: { linha1: string; linha2?: string }
  titulo: ReactNode
  texto: ReactNode
  acoes: ReactNode
}

const TOM: Record<Tom, { faixa: string; rotulo: string }> = {
  terra: { faixa: 'bg-terra-500', rotulo: 'text-terra-700' },
  pine: { faixa: 'bg-pine-600', rotulo: 'text-pine-700' },
  sun: { faixa: 'bg-sun-500', rotulo: 'text-sun-800' },
  leaf: { faixa: 'bg-leaf-500', rotulo: 'text-leaf-700' },
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const verPedido = (c: Candidatura) => `/gestao/pedidos?pedido=${encodeURIComponent(c.id)}`

/** "Precisa da sua atenção" — uma agenda curta, pela ordem em que convém tratar. */
export function AttentionList({ lar, cands }: { lar: Lar; cands: Candidatura[] }) {
  const agora = useAgora()
  const itens: Item[] = []
  const a = assuntosPendentes(lar, cands, agora)

  // 1. pedidos novos (urgentes primeiro)
  for (const c of a.novos) {
    itens.push({
      id: `novo-${c.id}`,
      tom: 'terra',
      icon: Inbox,
      rotulo: 'Pedido novo',
      quando: { linha1: capitalizar(tempoRelativo(c.criadaEm, new Date(agora))) },
      titulo: (
        <>
          {c.perfil.nome}, {c.perfil.idade} anos
        </>
      ),
      texto: (
        <>
          <span className="mb-1.5 block">
            <UrgenciaBadge urgencia={c.perfil.urgencia} />
          </span>
          {relacaoTexto(c)} · {perfilLinha(c)}
        </>
      ),
      acoes: (
        <>
          <ButtonLink to={verPedido(c)} variant="primary" iconRight={<ArrowRight aria-hidden className="size-5" />}>
            Abrir pedido
          </ButtonLink>
          {c.contacto.telefone && (
            <a href={`tel:${c.contacto.telefone.replace(/\s/g, '')}`} className="link inline-flex min-h-12 items-center gap-2 px-2">
              <Phone aria-hidden className="size-4.5" /> {c.contacto.telefone}
            </a>
          )}
        </>
      ),
    })
  }

  // 2. visitas por confirmar (mais próximas primeiro)
  for (const c of a.visitas) {
    const v = textoVisitaCurto(c.visita!)
    itens.push({
      id: `visita-${c.id}`,
      tom: 'pine',
      icon: CalendarCheck,
      rotulo: 'Visita por confirmar',
      quando: { linha1: capitalizar(v.dia), linha2: v.hora },
      titulo: <>{c.contacto.nome} quer visitar a casa</>,
      texto: (
        <>
          Com {c.perfil.nome} em mente ({c.perfil.idade} anos). Pedido para {textoVisita(c.visita!)}.
        </>
      ),
      acoes: (
        <>
          <Button
            variant="primary"
            icon={<CalendarCheck aria-hidden className="size-5" />}
            onClick={() => {
              confirmarVisita(c.id)
              toast.success('Visita confirmada', `${c.contacto.nome} recebeu a confirmação para ${textoVisita(c.visita!)}.`)
            }}
          >
            Confirmar visita
          </Button>
          <ButtonLink to={verPedido(c)} variant="ghost">
            Ver pedido
          </ButtonLink>
        </>
      ),
    })
  }

  // 3. vagas propostas à espera da família
  for (const c of a.propostas) {
    const p = prazo(c.prazoResposta, agora)
    itens.push({
      id: `proposta-${c.id}`,
      tom: p?.expirado ? 'terra' : 'sun',
      icon: Hourglass,
      rotulo: p?.expirado ? 'Prazo de resposta terminou' : 'À espera da família',
      quando: { linha1: p ? (p.expirado ? 'Terminou' : capitalizar(p.texto)) : '—', linha2: p && !p.expirado ? 'para responder' : undefined },
      titulo: <>Vaga proposta a {c.perfil.nome}</>,
      texto: p?.expirado ? (
        <>O prazo de 48 horas {p.texto}. Pode ligar a {c.contacto.nome} ou retirar a proposta e passar à pessoa seguinte da lista.</>
      ) : (
        <>
          {c.contacto.nome} está a decidir. Recebe a resposta aqui e no sino de notificações{p ? ` — ${p.texto}` : ''}.
        </>
      ),
      acoes: (
        <ButtonLink to={verPedido(c)} variant={p?.expirado ? 'primary' : 'secondary'}>
          Ver proposta
        </ButtonLink>
      ),
    })
  }

  // 4. lugar livre + lista de espera sem proposta em curso
  const livres = lar.quartos.filter((q) => q.livres > 0)
  const lista = cands.filter((c) => c.estado === 'lista_espera')
  const totalLivres = livres.reduce((s, q) => s + q.livres, 0)
  if (a.vagaPorPreencher) {
    const primeiro = [...lista].sort((x, y) => (x.posicao ?? 999) - (y.posicao ?? 999))[0]
    itens.push({
      id: 'vaga-lista',
      tom: 'leaf',
      icon: BedDouble,
      rotulo: 'Lugar livre por preencher',
      quando: { linha1: 'Agora' },
      titulo: (
        <>
          {totalLivres === 1 ? 'Tem 1 lugar livre' : `Tem ${totalLivres} lugares livres`} ({livres.map((q) => QUARTO_CURTO[q.tipo].toLowerCase()).join(', ')})
        </>
      ),
      texto: (
        <>
          {lista.length === 1 ? 'Há 1 família' : `Há ${lista.length} famílias`} da plataforma na lista de espera
          {primeiro?.posicao ? ` — a mais bem colocada está na posição ${primeiro.posicao}` : ''}. Propor a vaga daqui poupa telefonemas.
        </>
      ),
      acoes: (
        <ButtonLink to="/gestao/pedidos?filtro=lista" variant="secondary" iconRight={<ArrowRight aria-hidden className="size-5" />}>
          Ver lista de espera
        </ButtonLink>
      ),
    })
  }

  // 5. vagas por confirmar há mais de uma semana
  if (a.desatualizada) {
    itens.push({
      id: 'frescura',
      tom: 'sun',
      icon: RefreshCw,
      rotulo: 'Vagas por confirmar',
      quando: { linha1: `Há ${Math.floor(diasDesde(lar.atualizadoEm, agora))} dias` },
      titulo: <>As vagas não são confirmadas há mais de uma semana</>,
      texto: <>As famílias desconfiam de fichas antigas. Se nada mudou, basta confirmar.</>,
      acoes: (
        <Button
          variant="secondary"
          icon={<CircleCheck aria-hidden className="size-5" />}
          onClick={() => {
            confirmarVagasAtualizadas(lar.id)
            toast.success('Vagas confirmadas', 'A sua ficha mostra agora que a informação é de hoje.')
          }}
        >
          Está tudo certo
        </Button>
      ),
    })
  }

  return (
    <section aria-labelledby="atencao-titulo" className="flex flex-col gap-5">
      <PanelHeading
        id="atencao-titulo"
        eyebrow={itens.length ? `${itens.length} ${itens.length === 1 ? 'assunto' : 'assuntos'}` : 'Agenda'}
        title={
          <>
            Precisa da sua <em>atenção</em>
          </>
        }
      />
      {itens.length === 0 ? (
        <div className="flex items-start gap-4 rounded-3xl border-2 border-dashed border-leaf-200 bg-leaf-50/60 p-6">
          <CircleCheck aria-hidden className="mt-0.5 size-8 shrink-0 text-leaf-600" />
          <div>
            <p className="text-lg font-bold">Nada à espera de si.</p>
            <p className="mt-1 text-ink-soft">Os pedidos novos e os pedidos de visita aparecem aqui assim que chegam — e também no sino de notificações, no topo.</p>
          </div>
        </div>
      ) : (
        <ol className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          {itens.map((it) => {
            const t = TOM[it.tom]
            return (
              <li key={it.id} className="relative grid gap-x-5 gap-y-2 border-t border-line p-5 first:border-t-0 sm:grid-cols-[6.5rem_1fr] sm:p-6">
                <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1.5', t.faixa)} />
                <p className="text-sm text-ink-mute sm:pt-0.5">
                  <span className="font-bold text-ink sm:block">{it.quando.linha1}</span>
                  {it.quando.linha2 && <span className="ml-1.5 sm:ml-0 sm:block">{it.quando.linha2}</span>}
                </p>
                <div className="min-w-0">
                  <p className={cn('flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] uppercase', t.rotulo)}>
                    <it.icon aria-hidden className="size-4" />
                    {it.rotulo}
                  </p>
                  <h3 className="mt-1 font-sans text-lg leading-snug font-bold">{it.titulo}</h3>
                  <p className="mt-1 text-ink-soft">{it.texto}</p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">{it.acoes}</div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
