import { CalendarCheck, CalendarClock, Hourglass, Mail, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { confirmarVisita } from '@/lib/store'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { prazo, textoVisita } from '../lib/derive'

const ESTADO: Record<Candidatura['estado'], { tone: BadgeTone; texto: string }> = {
  enviada: { tone: 'terra', texto: 'Novo' },
  em_analise: { tone: 'pine', texto: 'Em análise' },
  lista_espera: { tone: 'dusk', texto: 'Lista de espera' },
  vaga_proposta: { tone: 'sun', texto: 'Vaga proposta' },
  aceite: { tone: 'leaf', texto: 'Entrada confirmada' },
  recusada: { tone: 'neutral', texto: 'Não aceite' },
  cancelada: { tone: 'neutral', texto: 'Cancelado pela família' },
}

export function EstadoTag({ c, size = 'md' }: { c: Candidatura; size?: 'sm' | 'md' }) {
  const e = ESTADO[c.estado]
  return (
    <Badge tone={e.tone} size={size}>
      {e.texto}
      {(c.estado === 'lista_espera' || c.estado === 'vaga_proposta') && c.posicao != null && <span className="font-normal">· n.º {c.posicao}</span>}
    </Badge>
  )
}

/** Necessidades de saúde, marcadas conforme a instituição as assegura ou não. */
export function NecessidadesChips({ lar, c, className }: { lar: Lar; c: Candidatura; className?: string }) {
  const nec = c.perfil.necessidades
  if (!nec.length) return <p className={cn('text-sm text-ink-soft', className)}>Sem necessidades de saúde específicas indicadas.</p>
  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="Necessidades de saúde">
      {nec.map((n) => {
        const Icon = CUIDADO_ICON[n]
        const ok = lar.cuidados.includes(n)
        const critico = CUIDADOS_CRITICOS.includes(n)
        return (
          <li
            key={n}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm font-semibold',
              ok ? 'border-pine-100 bg-pine-50 text-pine-900' : 'border-alert-600/30 bg-alert-50 text-alert-700',
            )}
          >
            <Icon aria-hidden className={cn('size-4', ok ? 'text-pine-700' : 'text-alert-600')} />
            {CUIDADO_LABEL[n]}
            {!ok && <span className="font-bold">· não assegura</span>}
            {critico && ok && <span className="sr-only">(essencial, assegurado)</span>}
          </li>
        )
      })}
    </ul>
  )
}

export function ContactoLinks({ c, className }: { c: Candidatura; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {c.contacto.telefone && (
        <a
          href={`tel:${c.contacto.telefone.replace(/\s/g, '')}`}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-line-strong bg-white px-4 font-bold text-ink transition-colors hover:border-pine-600 hover:text-pine-800"
        >
          <Phone aria-hidden className="size-5 text-pine-700" />
          <span>
            <span className="sr-only">Ligar para {c.contacto.nome}: </span>
            {c.contacto.telefone}
          </span>
        </a>
      )}
      <a
        href={`mailto:${c.contacto.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
        className="inline-flex min-h-12 min-w-0 items-center gap-2 rounded-2xl px-3 font-semibold text-pine-800 underline decoration-pine-300 decoration-2 underline-offset-4 hover:decoration-pine-600"
      >
        <Mail aria-hidden className="size-5 shrink-0" />
        <span className="truncate">{c.contacto.email}</span>
      </a>
    </div>
  )
}

/** Pedido de visita: pedida → um toque para confirmar; confirmada → lembrete. */
export function VisitaCallout({ c, className }: { c: Candidatura; className?: string }) {
  const v = c.visita
  if (!v || ['recusada', 'cancelada'].includes(c.estado)) return null
  if (v.estado === 'pedida') {
    return (
      <div className={cn('flex flex-col gap-3 rounded-2xl border-2 border-pine-200 bg-pine-50 p-4 sm:flex-row sm:items-center sm:justify-between', className)}>
        <p className="flex items-start gap-2.5">
          <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0 text-pine-700" />
          <span>
            <strong>Pediu uma visita</strong> para {textoVisita(v)}.
          </span>
        </p>
        <Button
          variant="primary"
          icon={<CalendarCheck aria-hidden className="size-5" />}
          className="shrink-0"
          onClick={() => {
            confirmarVisita(c.id)
            toast.success('Visita confirmada', `${c.contacto.nome} recebeu a confirmação para ${textoVisita(v)}.`)
          }}
        >
          Confirmar visita
        </Button>
      </div>
    )
  }
  return (
    <p className={cn('flex items-start gap-2.5 rounded-2xl bg-leaf-50 p-4 text-leaf-700', className)}>
      <CalendarCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>
        <strong>Visita {v.estado === 'realizada' ? 'realizada' : 'confirmada'}</strong> — {textoVisita(v)}.
      </span>
    </p>
  )
}

/** Vaga proposta: contagem do prazo de 48 horas. */
export function PropostaCallout({ c, agora, className }: { c: Candidatura; agora: number; className?: string }) {
  if (c.estado !== 'vaga_proposta') return null
  const p = prazo(c.prazoResposta, agora)
  const pctRestante = p && !p.expirado ? Math.max(0, Math.min(1, p.horas / 48)) : 0
  return (
    <div className={cn('rounded-2xl border-2 p-4', p?.expirado ? 'border-alert-600/30 bg-alert-50' : 'border-sun-200 bg-sun-50', className)}>
      <p className="flex items-start gap-2.5">
        <Hourglass aria-hidden className={cn('mt-0.5 size-5 shrink-0', p?.expirado ? 'text-alert-600' : 'text-sun-700')} />
        <span>
          {p?.expirado ? (
            <>
              <strong>O prazo de resposta {p.texto}.</strong> Ligue à família ou retire a proposta para a passar à pessoa seguinte da lista.
            </>
          ) : (
            <>
              <strong>À espera da resposta da família</strong>
              {p ? ` — ${p.texto}.` : '.'} A resposta chega aqui e no sino de notificações.
            </>
          )}
        </span>
      </p>
      {p && !p.expirado && (
        <span className="mt-3 block h-2 overflow-hidden rounded-full bg-sun-100" aria-hidden>
          <span className="block h-full rounded-full bg-sun-500" style={{ width: `${pctRestante * 100}%` }} />
        </span>
      )}
    </div>
  )
}
