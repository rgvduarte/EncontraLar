import { Check, Clock, Lock, Mail, Phone, X } from 'lucide-react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { confirmarVisita } from '@/lib/store'
import { entradaVerificada } from '@/lib/negocio'
import { cn } from '@/lib/cn'
import { prazo, textoVisita, verificarCompatibilidade } from '../lib/derive'
import { Barra, Troca } from '../shared/motion'
import { altaTexto, bloqueado, diaCurto, encaminhadoPor, nomeContacto, quemPediu, telHref } from '../shared/pedidoBits'
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
  // antes de aceitar o pedido, o contacto não existe para o lar (RGPD art. 9.º)
  if (bloqueado(c)) return null
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
  if (v.estado === 'pedida' && bloqueado(c)) {
    // para combinar a visita é preciso o contacto: primeiro aceitar o pedido
    return (
      <p className={className}>
        <span className="font-semibold">Pediu uma visita:</span> <span className="text-ink-soft">{quando}. Aceite o pedido para a confirmar.</span>
      </p>
    )
  }
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
            toast.success('Visita confirmada', `${capitalizar(quemPediu(c))} recebeu a confirmação para ${quando}.`)
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

/** Origem do pedido: "Encaminhado por <organização>" e, com alta prevista, "Alta em N dias" (a vermelho até 7 dias). */
export function OrigemBadges({ c, agora, className }: { c: Candidatura; agora: number; className?: string }) {
  const org = encaminhadoPor(c)
  if (!org) return null
  const alta = altaTexto(c.encaminhamento?.altaPrevista, agora)
  return (
    <p className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* nomes de organizações longos partem linha em vez de alargar a página no telemóvel */}
      <Badge tone="terra" className="whitespace-normal">
        {org}
      </Badge>
      {alta && (
        <Badge tone={alta.dias >= 0 && alta.dias <= 7 ? 'alert' : 'neutral'} icon={<Clock aria-hidden strokeWidth={2} />}>
          {alta.texto}
        </Badge>
      )}
    </p>
  )
}

/** Explicação curta do bloqueio: antes de aceitar, só o resumo anónimo (e, se nunca foi aceite, fica assim). */
export function AvisoBloqueio({ c, className }: { c: Candidatura; className?: string }) {
  const texto =
    c.estado === 'enviada'
      ? 'Os dados pessoais aparecem quando aceitar o pedido.'
      : c.estado === 'cancelada'
        ? 'O pedido foi cancelado antes de o aceitar: os dados pessoais não chegaram a ficar visíveis.'
        : 'Recusou o pedido sem o aceitar: os dados pessoais não chegaram a ficar visíveis.'
  return (
    <p className={cn('flex items-start gap-2 text-sm text-ink-mute', className)}>
      <Lock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      {texto}
    </p>
  )
}

/** Estado das confirmações de uma entrada, em texto (nunca só por cor). */
export function estadoEntrada(c: Candidatura): { texto: string; verificada: boolean; falta: 'familia' | 'lar' | null } {
  if (entradaVerificada(c)) return { texto: 'Entrada verificada', verificada: true, falta: null }
  if (c.entrada?.confirmadaLarEm) return { texto: 'A aguardar confirmação da família', verificada: false, falta: 'familia' }
  return { texto: 'A família confirmou a entrada. Falta a sua confirmação', verificada: false, falta: 'lar' }
}

/** "Entrou a 2 de outubro" + "Entrada verificada" / "A aguardar confirmação da família". */
export function EntradaLinha({ c, className }: { c: Candidatura; className?: string }) {
  if (!c.entrada) return null
  const e = estadoEntrada(c)
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="font-semibold">Entrou a {diaCurto(c.entrada.data)}</p>
      <p className={cn('flex items-start gap-1.5 text-sm', e.verificada ? 'font-medium text-leaf-700' : 'text-ink-mute')}>
        {e.verificada ? (
          <Check aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
        ) : (
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        )}
        <span>
          {e.texto}
          {e.falta === 'familia' && <span className="text-ink-mute">. Pedimos a {nomeContacto(c).split(' ')[0]} que confirme.</span>}
        </span>
      </p>
    </div>
  )
}
