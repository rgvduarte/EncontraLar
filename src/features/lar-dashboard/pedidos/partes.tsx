import { Check, Mail, Phone, X } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { confirmarVisita } from '@/lib/store'
import { cn } from '@/lib/cn'
import { prazo, textoVisita, verificarCompatibilidade } from '../lib/derive'
import { Barra, Troca } from '../shared/motion'
import { telHref } from '../shared/pedidoBits'
import { capitalizar } from '../shared/ui'

const ESTADO: Record<Candidatura['estado'], { tone: BadgeTone; texto: string }> = {
  enviada: { tone: 'terra', texto: 'Novo' },
  em_analise: { tone: 'neutral', texto: 'Em análise' },
  lista_espera: { tone: 'dusk', texto: 'Lista de espera' },
  vaga_proposta: { tone: 'sun', texto: 'Vaga proposta' },
  aceite: { tone: 'leaf', texto: 'Vaga aceite' },
  admitida: { tone: 'leaf', texto: 'Entrou' },
  recusada: { tone: 'neutral', texto: 'Não aceite' },
  cancelada: { tone: 'neutral', texto: 'Cancelado pela família' },
}

/** Etiqueta do estado — quando o estado muda, a nova etiqueta entra com um leve desfoque. */
export function EstadoTag({ c }: { c: Candidatura }) {
  const e = ESTADO[c.estado]
  return (
    <Troca k={c.estado}>
      <Badge tone={e.tone}>
        {e.texto}
        {(c.estado === 'lista_espera' || c.estado === 'vaga_proposta') && c.posicao != null && <span className="font-normal">· n.º {c.posicao}</span>}
      </Badge>
    </Troca>
  )
}

/** Verificação automática do pedido contra a ficha: linhas curtas "cumpre / falta", sempre com texto. */
export function CompatLines({ lar, perfil, className }: { lar: Lar; perfil: PerfilIdoso; className?: string }) {
  const checks = verificarCompatibilidade(lar, perfil)
  const faltas = checks.filter((c) => c.estado === 'falta').length
  return (
    <div className={className}>
      <p className={cn('text-sm font-semibold', faltas ? 'text-alert-700' : 'text-ink')}>
        {faltas ? `${faltas} ${faltas === 1 ? 'ponto a verificar' : 'pontos a verificar'}` : 'Compatível com a sua ficha'}
      </p>
      <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            {c.estado === 'ok' ? (
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-leaf-600" strokeWidth={2.5} />
            ) : (
              <X aria-hidden className="mt-0.5 size-4 shrink-0 text-alert-600" strokeWidth={2.5} />
            )}
            <span className={c.estado === 'ok' ? 'text-ink-soft' : 'text-alert-700'}>
              <span className="sr-only">{c.estado === 'ok' ? 'Cumpre — ' : 'Falta — '}</span>
              {c.texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Telefone e email da família, como ligações diretas. */
export function ContactoLinks({ c, className }: { c: Candidatura; className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-5', className)}>
      {c.contacto.telefone && (
        <a href={telHref(c.contacto.telefone)} className="link inline-flex min-h-11 items-center gap-1.5">
          <Phone aria-hidden className="size-4" strokeWidth={1.75} />
          <span className="sr-only">Ligar para {c.contacto.nome}: </span>
          {c.contacto.telefone}
        </a>
      )}
      <a
        href={`mailto:${c.contacto.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
        className="link inline-flex min-h-11 min-w-0 items-center gap-1.5"
      >
        <Mail aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="sr-only">Escrever a {c.contacto.nome}: </span>
        <span className="truncate">{c.contacto.email}</span>
      </a>
    </p>
  )
}

/** Visita: pedida → um toque para confirmar; confirmada → lembrete. */
export function VisitaLinha({ c, className }: { c: Candidatura; className?: string }) {
  const v = c.visita
  if (!v || ['recusada', 'cancelada'].includes(c.estado)) return null
  const quando = textoVisita(v)
  if (v.estado === 'pedida') {
    return (
      <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-3', className)}>
        <p>
          <span className="font-semibold">Pediu uma visita:</span> <span className="text-ink-soft">{quando}.</span>
        </p>
        <Button
          className="max-sm:min-h-13 max-sm:w-full"
          onClick={() => {
            confirmarVisita(c.id)
            toast.success('Visita confirmada', `${c.contacto.nome} recebeu a confirmação para ${quando}.`)
          }}
        >
          Confirmar visita
        </Button>
      </div>
    )
  }
  return (
    <p className={cn('flex animate-fade-in items-start gap-2', className)}>
      <Check aria-hidden className="mt-1 size-4 shrink-0 text-leaf-600" strokeWidth={2.5} />
      <span>
        <span className="font-semibold">Visita {v.estado === 'realizada' ? 'realizada' : 'confirmada'}:</span> <span className="text-ink-soft">{quando}.</span>
      </span>
    </p>
  )
}

/** Vaga proposta: contagem do prazo de 48 horas, com barra fina. */
export function PropostaLinha({ c, agora, className }: { c: Candidatura; agora: number; className?: string }) {
  if (c.estado !== 'vaga_proposta') return null
  const p = prazo(c.prazoResposta, agora)
  const restante = p && !p.expirado ? Math.max(0, Math.min(1, p.horas / 48)) : 0
  return (
    <div className={className}>
      <p>
        {p?.expirado ? (
          <>
            <span className="font-semibold text-alert-700">O prazo de resposta {p.texto}.</span>{' '}
            <span className="text-ink-soft">Ligue à família ou retire a proposta para a passar à pessoa seguinte.</span>
          </>
        ) : (
          <>
            <span className="font-semibold">À espera da resposta da família.</span>{' '}
            <span className="text-ink-soft">{p ? `${capitalizar(p.texto)}.` : ''}</span>
          </>
        )}
      </p>
      {p && !p.expirado && <Barra value={restante} className="mt-2 max-w-56" fillClassName={restante < 0.25 ? 'bg-alert-600' : 'bg-sun-500'} />}
    </div>
  )
}
